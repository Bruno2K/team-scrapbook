import { afterEach, describe, expect, it } from "vitest";
import {
  getCounterValue,
  resetLifecycleState,
  resetLogWriter,
  resetMetrics,
  setLogWriter,
  shutdownProcess,
} from "../../src/platform/observability/index.js";
import { parseChatMessageCreatedPayload, OutboxPayloadError } from "../../src/modules/messaging/domain/chatMessageCreated.js";
import { retryDelayMs } from "../../src/platform/outbox/config.js";
import { classifyOutboxFailure } from "../../src/platform/outbox/processor.js";
import { createOutboxWorker } from "../../src/platform/outbox/worker.js";

const logs: Record<string, unknown>[] = [];

describe("outbox unit contracts", () => {
  afterEach(() => {
    resetLogWriter();
    resetMetrics();
    resetLifecycleState();
  });

  it("computes bounded exponential backoff from the persisted attempt count", () => {
    const config = { initialDelayMs: 1000, maxDelayMs: 8000 };
    expect(retryDelayMs(1, config)).toBe(1000);
    expect(retryDelayMs(2, config)).toBe(2000);
    expect(retryDelayMs(4, config)).toBe(8000);
    expect(retryDelayMs(12, config)).toBe(8000);
  });

  it("parses message-created v1 payloads without requiring unknown fields to fail", () => {
    const parsed = parseChatMessageCreatedPayload({
      messageId: "m1",
      conversationId: "c1",
      senderId: "s1",
      recipientId: "r1",
      extra: "ignored",
    });
    expect(parsed).toEqual({
      messageId: "m1",
      conversationId: "c1",
      senderId: "s1",
      recipientId: "r1",
    });
    expect(() => parseChatMessageCreatedPayload({ messageId: "m1" })).toThrow(OutboxPayloadError);
  });

  it("classifies payload errors as poison without using the exception message as a category", () => {
    expect(classifyOutboxFailure(Object.assign(new Error("OutboxPayloadError"), { name: "OutboxPayloadError" }))).toBe("poison");
    expect(classifyOutboxFailure(new Error("timeout while calling provider"))).toBe("timeout");
  });

  it("sleeps on database unavailability instead of spinning", async () => {
    logs.length = 0;
    setLogWriter((line) => logs.push(JSON.parse(line) as Record<string, unknown>));
    const sleeps: number[] = [];
    const worker = createOutboxWorker({
      db: {} as never,
      config: { pollIntervalMs: 5, unavailableBackoffMs: 40 },
      processBatch: async () => {
        throw new Error("ECONNREFUSED secret-token");
      },
      sleepFn: async (ms) => {
        sleeps.push(ms);
      },
      nowStopping: () => sleeps.length >= 2,
    });
    await worker.runUntilStopped();
    expect(sleeps).toEqual([40, 40]);
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain("secret-token");
    expect(logs.some((entry) => entry.event === "outbox.worker.poll_failure")).toBe(true);
  });

  it("shuts down a worker-only process without HTTP", async () => {
    const stopped: string[] = [];
    const result = await shutdownProcess({
      stopWorkers: async () => {
        stopped.push("worker");
      },
      disconnectDatabase: async () => {
        stopped.push("prisma");
      },
    });
    expect(result).toBe("completed");
    expect(stopped).toEqual(["worker", "prisma"]);
  });

  it("records bounded outbox metric labels", () => {
    resetMetrics();
    logs.length = 0;
    setLogWriter((line) => logs.push(JSON.parse(line) as Record<string, unknown>));
    expect(getCounterValue("outbox_events_claimed_total", { event_type: "messaging.message.created" })).toBe(0);
  });
});
