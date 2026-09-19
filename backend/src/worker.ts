import "dotenv/config";
import { pathToFileURL } from "node:url";
import { prisma } from "./db/client.js";
import {
  installProcessSignalHandlers,
  log,
  logStartup,
} from "./platform/observability/index.js";
import { createOutboxWorker } from "./platform/outbox/index.js";
import { registerProductOutboxConsumers } from "./registerOutboxConsumers.js";

export async function startOutboxWorkerProcess(): Promise<void> {
  logStartup();
  registerProductOutboxConsumers();
  const worker = createOutboxWorker({ db: prisma });
  installProcessSignalHandlers(
    {
      stopWorkers: () => worker.stop(),
      disconnectDatabase: () => prisma.$disconnect(),
    },
    { exit: (code) => process.exit(code) },
  );
  worker.start();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startOutboxWorkerProcess().catch((error) => {
    const errorName = error instanceof Error && /^[A-Za-z][A-Za-z0-9._]{0,63}$/.test(error.name)
      ? error.name
      : undefined;
    log.error({ event: "process.startup.failure", failureCategory: "unknown", errorName });
    process.exit(1);
  });
}
