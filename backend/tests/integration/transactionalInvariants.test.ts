import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { prisma } from "../../src/db/client.js";
import { issueAccessToken } from "../../src/modules/identity/index.js";
import { createMessageApplication } from "../../src/modules/messaging/application/messageApplication.js";
import { createPrismaMessageRepository } from "../../src/modules/messaging/persistence/prismaMessageRepository.js";
import { createPrismaRelationshipCommandRepository } from "../../src/modules/relationships/persistence/prismaRelationshipCommandRepository.js";
import { processAvailableOutboxWork } from "../../src/platform/outbox/processor.js";
import { readOutboxRuntimeConfig } from "../../src/platform/outbox/config.js";
import { registerProductOutboxConsumers } from "../../src/registerOutboxConsumers.js";

const prefix = `transactions_${Date.now()}_${Math.random().toString(16).slice(2)}`;

function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out at concurrency barrier: ${label}`)),
      4_000,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function createUser(label: string) {
  return prisma.user.create({
    data: {
      name: `Transactions ${label}`,
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

describe("Issue #34 transactional invariants", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { nickname: { startsWith: prefix } } });
  });

  it("sees the new friendship inside the transaction and rolls it back after a later failure", async () => {
    const sender = await createUser("rollback_sender");
    const recipient = await createUser("rollback_recipient");
    const friendRequest = await prisma.friendshipRequest.create({
      data: { fromUserId: sender.id, toUserId: recipient.id },
    });
    let visibleInsideTransaction = false;
    const repository = createPrismaRelationshipCommandRepository({
      async afterFriendshipCreated(context) {
        visibleInsideTransaction = context.friendshipVisibleInsideTransaction;
        throw new Error("injected later-write failure");
      },
    });

    await expect(repository.acceptFriendRequest(friendRequest.id, recipient.id))
      .rejects.toThrow("injected later-write failure");

    expect(visibleInsideTransaction).toBe(true);
    expect(await prisma.friendship.count({
      where: {
        OR: [
          { user1Id: sender.id, user2Id: recipient.id },
          { user1Id: recipient.id, user2Id: sender.id },
        ],
      },
    })).toBe(0);
    await expect(prisma.friendshipRequest.findUniqueOrThrow({ where: { id: friendRequest.id } }))
      .resolves.toMatchObject({ status: "PENDING", respondedAt: null });
  });

  it("serializes concurrent friend acceptance and blocking without contradictory state", async () => {
    const sender = await createUser("race_sender");
    const recipient = await createUser("race_recipient");
    const friendRequest = await prisma.friendshipRequest.create({
      data: { fromUserId: sender.id, toUserId: recipient.id },
    });

    let friendshipEntered!: () => void;
    let blockEntered!: () => void;
    let release!: () => void;
    const friendshipAtBarrier = new Promise<void>((resolve) => { friendshipEntered = resolve; });
    const blockAtBarrier = new Promise<void>((resolve) => { blockEntered = resolve; });
    const released = new Promise<void>((resolve) => { release = resolve; });
    const repository = createPrismaRelationshipCommandRepository({
      async afterFriendshipCreated() {
        friendshipEntered();
        await released;
      },
      async afterBlockStateRead() {
        blockEntered();
        await released;
      },
    });

    const acceptance = repository.acceptFriendRequest(friendRequest.id, recipient.id);
    const blocking = repository.blockUser(sender.id, recipient.id);
    await bounded(Promise.all([friendshipAtBarrier, blockAtBarrier]), "accept versus block");
    release();
    const [acceptanceResult, blockResult] = await Promise.all([acceptance, blocking]);

    expect(["accepted", "not_found", "blocked", "conflict", "already_applied"])
      .toContain(acceptanceResult);
    expect(blockResult).toBe("blocked");
    expect(await prisma.blockedUser.count({
      where: { blockerId: sender.id, blockedId: recipient.id },
    })).toBe(1);
    expect(await prisma.friendship.count({
      where: {
        OR: [
          { user1Id: sender.id, user2Id: recipient.id },
          { user1Id: recipient.id, user2Id: sender.id },
        ],
      },
    })).toBe(0);
    expect(await prisma.friendshipRequest.count({ where: { id: friendRequest.id } })).toBe(0);
  });

  it("serializes friend-request creation against blocking and keeps notification post-commit", async () => {
    const sender = await createUser("request_race_sender");
    const recipient = await createUser("request_race_recipient");
    let requestEntered!: () => void;
    let blockEntered!: () => void;
    let release!: () => void;
    const requestAtBarrier = new Promise<void>((resolve) => { requestEntered = resolve; });
    const blockAtBarrier = new Promise<void>((resolve) => { blockEntered = resolve; });
    const released = new Promise<void>((resolve) => { release = resolve; });
    const repository = createPrismaRelationshipCommandRepository({
      async afterFriendRequestWritten() {
        requestEntered();
        await released;
      },
      async afterBlockStateRead() {
        blockEntered();
        await released;
      },
    });

    const requestCreation = repository.requestFriendship(sender.id, recipient.id);
    const blocking = repository.blockUser(recipient.id, sender.id);
    await bounded(Promise.all([requestAtBarrier, blockAtBarrier]), "request versus block");
    release();
    const [requestResult, blockResult] = await Promise.all([requestCreation, blocking]);

    expect(["request_created", "blocked", "conflict"]).toContain(requestResult.status);
    expect(blockResult).toBe("blocked");
    expect(await prisma.blockedUser.count({
      where: { blockerId: recipient.id, blockedId: sender.id },
    })).toBe(1);
    expect(await prisma.friendshipRequest.count({
      where: {
        OR: [
          { fromUserId: sender.id, toUserId: recipient.id },
          { fromUserId: recipient.id, toUserId: sender.id },
        ],
      },
    })).toBe(0);
    expect(await prisma.notification.count({
      where: { userId: recipient.id, type: "FRIEND_REQUEST" },
    })).toBe(0);
  });

  it("rolls back a message visible inside its transaction when a later step fails", async () => {
    const { first, conversation } = await createFriendPair("message_rollback");
    const before = conversation.updatedAt;
    let visibleInsideTransaction = false;
    const repository = createPrismaMessageRepository({
      async afterMessageCreated(context) {
        visibleInsideTransaction = context.messageVisibleInsideTransaction;
        throw new Error("injected conversation-update failure");
      },
    });
    const application = createMessageApplication(repository, async () => true);

    await expect(application.send({
      conversationId: conversation.id,
      senderId: first.id,
      content: "must roll back",
      type: "TEXT",
    })).rejects.toThrow("injected conversation-update failure");

    expect(visibleInsideTransaction).toBe(true);
    expect(await prisma.chatMessage.count({ where: { conversationId: conversation.id } })).toBe(0);
    await expect(prisma.conversation.findUniqueOrThrow({ where: { id: conversation.id } }))
      .resolves.toMatchObject({ updatedAt: before });
  });

  it("deduplicates concurrent HTTP retries and maps key reuse with another payload to conflict", async () => {
    const { first, second, conversation } = await createFriendPair("http_retry");
    const token = issueAccessToken(first.id);
    const key = `${prefix}-message-key`;
    const body = { conversationId: conversation.id, content: "one logical message", type: "TEXT" };

    const [firstResponse, retryResponse] = await Promise.all([
      request(app).post("/chat/messages").set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", key).send(body),
      request(app).post("/chat/messages").set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", key).send(body),
    ]);

    expect([firstResponse.status, retryResponse.status].sort()).toEqual([200, 201]);
    expect(firstResponse.body.id).toBe(retryResponse.body.id);
    expect(await prisma.chatMessage.count({ where: { conversationId: conversation.id } })).toBe(1);
    registerProductOutboxConsumers();
    await processAvailableOutboxWork(prisma, {
      workerId: "invariants-drain",
      config: readOutboxRuntimeConfig({ batchSize: 20, leaseMs: 5_000, maxAttempts: 8 }),
    });
    expect(await prisma.notification.count({
      where: {
        userId: second.id,
        type: "CHAT_MESSAGE",
        dedupeKey: `chat-message:${firstResponse.body.id}`,
      },
    })).toBe(1);

    const [user1Id, user2Id] = first.id < second.id
      ? [first.id, second.id]
      : [second.id, first.id];
    await prisma.$transaction([
      prisma.friendship.deleteMany({ where: { user1Id, user2Id } }),
      prisma.blockedUser.create({ data: { blockerId: second.id, blockedId: first.id } }),
    ]);
    const replayAfterBlock = await request(app)
      .post("/chat/messages")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", key)
      .send(body);
    expect(replayAfterBlock.status).toBe(200);
    expect(replayAfterBlock.body.id).toBe(firstResponse.body.id);

    const conflict = await request(app)
      .post("/chat/messages")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", key)
      .send({ ...body, content: "different message" });
    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({ message: "Idempotency-Key já usada com outra mensagem" });
    expect(await prisma.chatMessage.count({ where: { conversationId: conversation.id } })).toBe(1);
  });

  it("does not reveal whether another user's friend request ID exists", async () => {
    const sender = await createUser("oracle_sender");
    const recipient = await createUser("oracle_recipient");
    const outsider = await createUser("oracle_outsider");
    const friendRequest = await prisma.friendshipRequest.create({
      data: { fromUserId: sender.id, toUserId: recipient.id },
    });
    const token = issueAccessToken(outsider.id);

    const existing = await request(app)
      .post(`/users/me/friend-requests/${friendRequest.id}/accept`)
      .set("Authorization", `Bearer ${token}`);
    const missing = await request(app)
      .post("/users/me/friend-requests/not-a-real-request/accept")
      .set("Authorization", `Bearer ${token}`);

    expect(existing.status).toBe(403);
    expect(missing.status).toBe(403);
    expect(existing.body).toEqual(missing.body);
    await expect(prisma.friendshipRequest.findUniqueOrThrow({ where: { id: friendRequest.id } }))
      .resolves.toMatchObject({ status: "PENDING" });
  });

  it("keeps a committed message truthful when its post-commit effect fails", async () => {
    const { first, conversation } = await createFriendPair("post_commit");
    const repository = createPrismaMessageRepository();
    const application = createMessageApplication(repository, async () => true);

    const outcome = await application.send({
      conversationId: conversation.id,
      senderId: first.id,
      content: "committed before delivery",
      type: "TEXT",
      idempotencyKey: `${prefix}-post-commit-key`,
    }, {
      async afterCommit() {
        throw new Error("delivery unavailable");
      },
    });

    expect(outcome).toMatchObject({
      disposition: "created",
      postCommitEffectFailed: true,
    });
    expect(await prisma.chatMessage.count({ where: { id: outcome!.message.id } })).toBe(1);
  });
});
