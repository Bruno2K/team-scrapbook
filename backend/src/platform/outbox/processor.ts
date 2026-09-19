import type { PrismaClient } from "@prisma/client";
import { classifyUnknownFailure, type FailureCategory } from "../observability/dependencies.js";
import { log } from "../observability/logger.js";
import {
  recordOutboxAttempt,
  recordOutboxCompleted,
  recordOutboxLeaseRecovered,
  recordOutboxProcessingDuration,
  recordOutboxRetryableFailure,
  recordOutboxTerminalFailure,
  setOutboxBacklog,
} from "../observability/metrics.js";
import { retryDelayMs, type OutboxRuntimeConfig } from "./config.js";
import { defaultOutboxConsumers, type OutboxConsumerRegistry } from "./registry.js";
import {
  claimOutboxBatch,
  countOutboxBacklog,
  markOutboxCompleted,
  markOutboxFailed,
  markOutboxRetry,
} from "./store.js";
import type { OutboxEventRecord } from "./types.js";

const ERROR_CODE = /^[A-Za-z][A-Za-z0-9._]{0,63}$/;

export function boundedErrorCode(error: unknown): string {
  const name = error instanceof Error ? error.name : "Error";
  return ERROR_CODE.test(name) ? name : "Error";
}

export function classifyOutboxFailure(error: unknown): FailureCategory | "poison" {
  if (error instanceof Error && error.name === "OutboxPayloadError") return "poison";
  if (error instanceof Error && error.message === "OutboxPayloadError") return "poison";
  return classifyUnknownFailure(error);
}

function logStaleClaim(eventType: string): void {
  log.warn({ event: "outbox.stale_claim", eventType, outcome: "failure", failureCategory: "conflict" });
}

export async function processClaimedEvent(
  db: PrismaClient,
  event: OutboxEventRecord,
  config: OutboxRuntimeConfig,
  registry: OutboxConsumerRegistry = defaultOutboxConsumers,
  workerId = event.claimOwner ?? "",
): Promise<"completed" | "retry" | "failed" | "stale"> {
  const started = Date.now();
  const eventType = event.eventType;
  recordOutboxAttempt(eventType);

  if (event.previousStatus === "PROCESSING") {
    recordOutboxLeaseRecovered(eventType);
    log.warn({
      event: "outbox.lease.recovered",
      eventType,
      outcome: "success",
    });
  }

  if (event.attemptCount > config.maxAttempts) {
    const written = await markOutboxFailed(db, {
      id: event.id,
      claimOwner: workerId,
      failureCategory: event.failureCategory ?? "unknown",
      lastErrorCode: event.lastErrorCode ?? "AttemptCeiling",
    });
    if (!written) {
      logStaleClaim(eventType);
      return "stale";
    }
    recordOutboxTerminalFailure(eventType, event.failureCategory ?? "unknown");
    recordOutboxProcessingDuration(eventType, "failure", Date.now() - started);
    log.error({
      event: "outbox.terminal_failure",
      eventType,
      outcome: "failure",
      failureCategory: event.failureCategory ?? "unknown",
      errorCode: event.lastErrorCode ?? "AttemptCeiling",
    });
    return "failed";
  }

  log.info({ event: "outbox.claim", eventType, outcome: "success" });

  const handler = registry.resolve(event.eventType, event.eventVersion);
  if (!handler) {
    if (event.attemptCount >= config.maxAttempts) {
      const written = await markOutboxFailed(db, {
        id: event.id,
        claimOwner: workerId,
        failureCategory: "not_configured",
        lastErrorCode: "HandlerMissing",
      });
      if (!written) {
        logStaleClaim(eventType);
        return "stale";
      }
      recordOutboxTerminalFailure(eventType, "not_configured");
      recordOutboxProcessingDuration(eventType, "failure", Date.now() - started);
      log.error({
        event: "outbox.terminal_failure",
        eventType,
        outcome: "failure",
        failureCategory: "not_configured",
        errorCode: "HandlerMissing",
      });
      return "failed";
    }
    const delay = retryDelayMs(Math.max(1, event.attemptCount), config);
    const written = await markOutboxRetry(db, {
      id: event.id,
      claimOwner: workerId,
      availableAt: new Date(Date.now() + delay),
      failureCategory: "not_configured",
      lastErrorCode: "HandlerMissing",
    });
    if (!written) {
      logStaleClaim(eventType);
      return "stale";
    }
    recordOutboxRetryableFailure(eventType, "not_configured");
    recordOutboxProcessingDuration(eventType, "failure", Date.now() - started);
    log.warn({
      event: "outbox.retry_scheduled",
      eventType,
      outcome: "failure",
      failureCategory: "not_configured",
      errorCode: "HandlerMissing",
      durationMs: delay,
    });
    return "retry";
  }

  try {
    await handler({
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      payload: event.payload,
    });
    const written = await markOutboxCompleted(db, { id: event.id, claimOwner: workerId });
    if (!written) {
      logStaleClaim(eventType);
      return "stale";
    }
    recordOutboxCompleted(eventType);
    recordOutboxProcessingDuration(eventType, "success", Date.now() - started);
    log.info({ event: "outbox.processing.success", eventType, outcome: "success" });
    return "completed";
  } catch (error) {
    const failureCategory = classifyOutboxFailure(error);
    const lastErrorCode = boundedErrorCode(error);
    if (event.attemptCount >= config.maxAttempts) {
      const written = await markOutboxFailed(db, {
        id: event.id,
        claimOwner: workerId,
        failureCategory,
        lastErrorCode,
      });
      if (!written) {
        logStaleClaim(eventType);
        return "stale";
      }
      recordOutboxTerminalFailure(eventType, failureCategory);
      recordOutboxProcessingDuration(eventType, "failure", Date.now() - started);
      log.error({
        event: "outbox.terminal_failure",
        eventType,
        outcome: "failure",
        failureCategory,
        errorCode: lastErrorCode,
      });
      return "failed";
    }
    const delay = retryDelayMs(event.attemptCount, config);
    const written = await markOutboxRetry(db, {
      id: event.id,
      claimOwner: workerId,
      availableAt: new Date(Date.now() + delay),
      failureCategory,
      lastErrorCode,
    });
    if (!written) {
      logStaleClaim(eventType);
      return "stale";
    }
    recordOutboxRetryableFailure(eventType, failureCategory);
    recordOutboxProcessingDuration(eventType, "failure", Date.now() - started);
    log.warn({
      event: "outbox.retry_scheduled",
      eventType,
      outcome: "failure",
      failureCategory,
      errorCode: lastErrorCode,
      durationMs: delay,
    });
    return "retry";
  }
}

export async function processAvailableOutboxWork(
  db: PrismaClient,
  input: {
    workerId: string;
    config: OutboxRuntimeConfig;
    registry?: OutboxConsumerRegistry;
  },
): Promise<number> {
  const claimed = await claimOutboxBatch(db, {
    batchSize: input.config.batchSize,
    leaseMs: input.config.leaseMs,
    workerId: input.workerId,
    maxAttempts: input.config.maxAttempts,
  });
  setOutboxBacklog(await countOutboxBacklog(db));
  for (const event of claimed) {
    await processClaimedEvent(
      db,
      event,
      input.config,
      input.registry ?? defaultOutboxConsumers,
      input.workerId,
    );
  }
  return claimed.length;
}
