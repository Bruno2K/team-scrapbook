import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/db/client.js";
import { createMessageApplication } from "../../src/modules/messaging/application/messageApplication.js";
import { createPrismaMessageRepository } from "../../src/modules/messaging/persistence/prismaMessageRepository.js";
import { getCounterValue, resetMetrics } from "../../src/platform/observability/index.js";
import { readOutboxRuntimeConfig } from "../../src/platform/outbox/config.js";
import { createOutboxConsumerRegistry } from "../../src/platform/outbox/registry.js";
import { claimOutboxBatch, replayTerminalOutboxEvent } from "../../src/platform/outbox/store.js";
import { processAvailableOutboxWork, processClaimedEvent } from "../../src/platform/outbox/processor.js";
import { createOutboxWorker } from "../../src/platform/outbox/worker.js";
import { OutboxPayloadError } from "../../src/modules/messaging/domain/chatMessageCreated.js";
import { registerProductOutboxConsumers } from "../../src/registerOutboxConsumers.js";

const prefix = `outbox_${Date.now()}_${Math.random().toString(16).slice(2)}`;

async function createUser(label: string) {
  return prisma.user.create({
    data: {
      name: `Outbox ${label}`,
      nickname: `${prefix}_${label}`,
      passwordHash: "integration-test-only",
    },
  });
}

async function createFriendPair(label: string) {
  const first = await createUser(`${label}_first`);
  const second = await createUser(`${label}_second`);
  const [user1Id, user2Id] = first.id < second.id
    ? [first.id, second.id]
    : [second.id, first.id];
  await prisma.friendship.create({ data: { user1Id, user2Id } });
  const conversation = await prisma.conversation.create({ data: { user1Id, user2Id } });
  return { first, second, conversation };
}

async function persistMessage(label: string) {
  const pair = await createFriendPair(label);
  const application = createMessageApplication(createPrismaMessageRepository(), async () => true);
  const outcome = await application.send({
    conversationId: pair.conversation.id,
    senderId: pair.first.id,
    content: `hello ${label}`,
    type: "TEXT",
  });
  if (!outcome) throw new Error("expected message");
  return { ...pair, message: outcome.message };
}

const testConfig = readOutboxRuntimeConfig({
  maxAttempts: 3,
  initialDelayMs: 20,
  maxDelayMs: 80,
  leaseMs: 5_000,
  batchSize: 10,
  pollIntervalMs: 20,
  unavailableBackoffMs: 20,
});

describe("transactional outbox", () => {
  beforeAll(() => {
    registerProductOutboxConsumers();
    resetMetrics();
  });

  it("keeps the committed message and outbox event when processing has not run yet", async () => {
    const { message, second } = await persistMessage("crash_after_commit");
    const events = await prisma.outboxEvent.findMany({ where: { aggregateId: message.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: "messaging.message.created",
      eventVersion: 1,
      status: "PENDING",
    });
    expect(await prisma.notification.count({
      where: { userId: second.id, dedupeKey: `chat-message:${message.id}` },
    })).toBe(0);

    await processAvailableOutboxWork(prisma, { workerId: "w-commit", config: testConfig });
    expect(await prisma.notification.count({
      where: { userId: second.id, dedupeKey: `chat-message:${message.id}` },
    })).toBe(1);
    await expect(prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: message.id } }))
      .resolves.toMatchObject({ status: "COMPLETED" });
  });

  it("recovers a claimed event after the worker crashes before completion", async () => {
    const { message, second } = await persistMessage("crash_after_claim");
    const claimed = await claimOutboxBatch(prisma, {
      batchSize: 1,
      leaseMs: 30_000,
      workerId: "crashed-owner",
      maxAttempts: 8,
    });
    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.status).toBe("PROCESSING");
    expect(claimed[0]?.claimOwner).toBe("crashed-owner");

    await prisma.outboxEvent.update({
      where: { id: claimed[0]!.id },
      data: { availableAt: new Date(0) },
    });

    await processAvailableOutboxWork(prisma, { workerId: "w-recover", config: testConfig });
    expect(await prisma.notification.count({
      where: { userId: second.id, dedupeKey: `chat-message:${message.id}` },
    })).toBe(1);
    const recovered = await prisma.outboxEvent.findFirstOrThrow({ where: { id: claimed[0]!.id } });
    expect(recovered.status).toBe("COMPLETED");
    expect(recovered.claimOwner).toBeNull();
    expect(getCounterValue("outbox_lease_recovered_total", { event_type: "messaging.message.created" })).toBeGreaterThan(0);
  });

  it("does not duplicate the durable notification when the same event is processed twice", async () => {
    const { message, second } = await persistMessage("duplicate");
    await processAvailableOutboxWork(prisma, { workerId: "w-dup-1", config: testConfig });
    await prisma.outboxEvent.updateMany({
      where: { aggregateId: message.id },
      data: {
        status: "PENDING",
        attemptCount: 0,
        availableAt: new Date(0),
        processedAt: null,
        claimOwner: null,
        claimExpiresAt: null,
      },
    });
    await processAvailableOutboxWork(prisma, { workerId: "w-dup-2", config: testConfig });
    expect(await prisma.notification.count({
      where: { userId: second.id, dedupeKey: `chat-message:${message.id}` },
    })).toBe(1);
  });

  it("schedules bounded retry after a transient failure and later completes", async () => {
    const { message } = await persistMessage("transient");
    const event = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: message.id } });
    const registry = createOutboxConsumerRegistry();
    let attempts = 0;
    registry.register({
      eventType: "messaging.message.created",
      eventVersion: 1,
      async handler() {
        attempts += 1;
        if (attempts === 1) throw new Error("timeout contacting dependency");
      },
    });

    await processAvailableOutboxWork(prisma, { workerId: "w-transient-1", config: testConfig, registry });
    const retried = await prisma.outboxEvent.findFirstOrThrow({ where: { id: event.id } });
    expect(retried.status).toBe("PENDING");
    expect(retried.attemptCount).toBe(1);
    expect(retried.failureCategory).toBe("timeout");
    expect(retried.availableAt.getTime()).toBeGreaterThan(Date.now() + 5);
    await expect(prisma.outboxEvent.findMany({
      where: { id: event.id, availableAt: { lte: new Date() } },
    })).resolves.toHaveLength(0);

    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: { availableAt: new Date(0) },
    });
    await processAvailableOutboxWork(prisma, { workerId: "w-transient-2", config: testConfig, registry });
    await expect(prisma.outboxEvent.findFirstOrThrow({ where: { id: event.id } }))
      .resolves.toMatchObject({ status: "COMPLETED" });
    expect(attempts).toBe(2);
  });

  it("moves a poison event to a terminal failed state after the attempt ceiling", async () => {
    const { message } = await persistMessage("poison");
    const event = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: message.id } });
    const registry = createOutboxConsumerRegistry();
    registry.register({
      eventType: "messaging.message.created",
      eventVersion: 1,
      async handler() {
        throw new OutboxPayloadError();
      },
    });

    for (let i = 0; i < 3; i += 1) {
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { availableAt: new Date(0) },
      });
      await processAvailableOutboxWork(prisma, { workerId: `w-poison-${i}`, config: testConfig, registry });
    }

    const failed = await prisma.outboxEvent.findFirstOrThrow({ where: { id: event.id } });
    expect(failed.status).toBe("FAILED");
    expect(failed.attemptCount).toBe(3);
    expect(failed.failureCategory).toBe("poison");
    expect(failed.lastErrorCode).toBe("OutboxPayloadError");
    expect(failed.failedAt).not.toBeNull();

    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: { availableAt: new Date(0) },
    });
    await processAvailableOutboxWork(prisma, { workerId: "w-poison-extra", config: testConfig, registry });
    await expect(prisma.outboxEvent.findFirstOrThrow({ where: { id: event.id } }))
      .resolves.toMatchObject({ status: "FAILED", attemptCount: 3 });

    await replayTerminalOutboxEvent(prisma, event.id);
    await expect(prisma.outboxEvent.findFirstOrThrow({ where: { id: event.id } }))
      .resolves.toMatchObject({ status: "PENDING", attemptCount: 0 });
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: { status: "FAILED", availableAt: new Date("2099-01-01T00:00:00.000Z") },
    });
  });

  it("prevents concurrent workers from owning the same record", async () => {
    const first = await persistMessage("concurrent_a");
    const second = await persistMessage("concurrent_b");
    const third = await persistMessage("concurrent_c");
    const ids = new Set([first.message.id, second.message.id, third.message.id]);

    const [left, right] = await Promise.all([
      claimOutboxBatch(prisma, { batchSize: 10, leaseMs: 30_000, workerId: "w-a", maxAttempts: 8 }),
      claimOutboxBatch(prisma, { batchSize: 10, leaseMs: 30_000, workerId: "w-b", maxAttempts: 8 }),
    ]);
    const claimed = [...left, ...right].filter((row) => row.aggregateId && ids.has(row.aggregateId));
    const claimedIds = claimed.map((row) => row.id);
    expect(new Set(claimedIds).size).toBe(claimedIds.length);
    expect(claimed.length).toBe(3);
    for (const row of claimed) {
      expect(claimed.filter((other) => other.id === row.id)).toHaveLength(1);
      await processClaimedEvent(prisma, row, testConfig, undefined, row.claimOwner ?? "w-a");
    }
    expect(await prisma.notification.count({
      where: {
        dedupeKey: { in: [...ids].map((id) => `chat-message:${id}`) },
      },
    })).toBe(3);
  });

  it("ignores a stale worker's completion after the lease is recovered", async () => {
    const { message, second } = await persistMessage("stale_owner");
    const firstClaim = await claimOutboxBatch(prisma, {
      batchSize: 1,
      leaseMs: 30_000,
      workerId: "owner-a",
      maxAttempts: 8,
    });
    expect(firstClaim[0]?.aggregateId).toBe(message.id);
    await prisma.outboxEvent.update({
      where: { id: firstClaim[0]!.id },
      data: { availableAt: new Date(0) },
    });
    const secondClaim = await claimOutboxBatch(prisma, {
      batchSize: 1,
      leaseMs: 30_000,
      workerId: "owner-b",
      maxAttempts: 8,
    });
    expect(secondClaim[0]?.id).toBe(firstClaim[0]?.id);
    expect(secondClaim[0]?.claimOwner).toBe("owner-b");

    const stale = await processClaimedEvent(
      prisma,
      firstClaim[0]!,
      testConfig,
      undefined,
      "owner-a",
    );
    expect(stale).toBe("stale");
    await expect(prisma.outboxEvent.findFirstOrThrow({ where: { id: firstClaim[0]!.id } }))
      .resolves.toMatchObject({ status: "PROCESSING", claimOwner: "owner-b" });

    await processClaimedEvent(prisma, secondClaim[0]!, testConfig, undefined, "owner-b");
    expect(await prisma.notification.count({
      where: { userId: second.id, dedupeKey: `chat-message:${message.id}` },
    })).toBe(1);
    await expect(prisma.outboxEvent.findFirstOrThrow({ where: { id: firstClaim[0]!.id } }))
      .resolves.toMatchObject({ status: "COMPLETED" });
  });

  it("retries a missing handler then marks it terminal as not_configured", async () => {
    const { message } = await persistMessage("missing_handler");
    const event = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: message.id } });
    const empty = createOutboxConsumerRegistry();
    for (let i = 0; i < 3; i += 1) {
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { availableAt: new Date(0) },
      });
      await processAvailableOutboxWork(prisma, { workerId: `w-missing-${i}`, config: testConfig, registry: empty });
    }
    const failed = await prisma.outboxEvent.findFirstOrThrow({ where: { id: event.id } });
    expect(failed.status).toBe("FAILED");
    expect(failed.failureCategory).toBe("not_configured");
    expect(failed.lastErrorCode).toBe("HandlerMissing");
    expect(failed.attemptCount).toBe(3);
  });

  it("resumes pending work when a new worker instance starts", async () => {
    const { message, second } = await persistMessage("restart");
    const worker = createOutboxWorker({
      db: prisma,
      workerId: "restarted",
      config: { ...testConfig, pollIntervalMs: 20, batchSize: 10 },
    });
    worker.start();
    await expect.poll(async () => prisma.notification.count({
      where: { userId: second.id, dedupeKey: `chat-message:${message.id}` },
    }), { timeout: 4_000, interval: 50 }).toBe(1);
    await worker.stop();
  });
});
