import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { isShuttingDown, log } from "../observability/index.js";
import { setOutboxWorkerUp } from "../observability/metrics.js";
import { readOutboxRuntimeConfig, type OutboxRuntimeConfig } from "./config.js";
import { processAvailableOutboxWork } from "./processor.js";
import type { OutboxConsumerRegistry } from "./registry.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export interface OutboxWorker {
  readonly workerId: string;
  start(): void;
  stop(): Promise<void>;
  runUntilStopped(): Promise<void>;
}

export function createOutboxWorker(options: {
  db: PrismaClient;
  config?: Partial<OutboxRuntimeConfig>;
  registry?: OutboxConsumerRegistry;
  workerId?: string;
  sleepFn?: (ms: number) => Promise<void>;
  nowStopping?: () => boolean;
  processBatch?: () => Promise<number>;
}): OutboxWorker {
  const config = readOutboxRuntimeConfig(options.config);
  const workerId = options.workerId ?? `outbox-${process.pid}-${randomUUID().slice(0, 8)}`;
  const sleepFn = options.sleepFn ?? sleep;
  let stopped = false;
  let running: Promise<void> | undefined;
  let wake: (() => void) | undefined;

  const interruptibleSleep = async (ms: number) => {
    if (stopped) return;
    await Promise.race([
      sleepFn(ms),
      new Promise<void>((resolve) => {
        wake = resolve;
      }),
    ]);
    wake = undefined;
  };

  const runUntilStopped = async () => {
    log.info({ event: "outbox.worker.startup", outcome: "success" });
    setOutboxWorkerUp(true);
    log.info({ event: "outbox.worker.ready", outcome: "success" });
    while (!stopped && !(options.nowStopping?.() ?? isShuttingDown())) {
      try {
        const processed = await (options.processBatch
          ?? (() => processAvailableOutboxWork(options.db, {
            workerId,
            config,
            registry: options.registry,
          })))();
        if (processed === 0) {
          await interruptibleSleep(config.pollIntervalMs);
        }
      } catch (error) {
        const failureCategory = error instanceof Error && /ECONNREFUSED|ENOTFOUND|P1001|P1017|can't reach/i.test(error.message)
          ? "network"
          : "unknown";
        log.error({
          event: "outbox.worker.poll_failure",
          dependency: "postgresql",
          outcome: "failure",
          failureCategory,
          errorName: error instanceof Error && /^[A-Za-z][A-Za-z0-9._]{0,63}$/.test(error.name) ? error.name : undefined,
        });
        await interruptibleSleep(config.unavailableBackoffMs);
      }
    }
    setOutboxWorkerUp(false);
    log.info({ event: "outbox.worker.shutdown", outcome: "success" });
  };

  return {
    workerId,
    start() {
      if (running) return;
      running = runUntilStopped().catch((error) => {
        log.error({
          event: "outbox.worker.crash",
          outcome: "failure",
          failureCategory: "unknown",
          errorName: error instanceof Error && /^[A-Za-z][A-Za-z0-9._]{0,63}$/.test(error.name) ? error.name : undefined,
        });
      });
    },
    async stop() {
      stopped = true;
      wake?.();
      await running;
    },
    runUntilStopped,
  };
}
