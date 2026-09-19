import "dotenv/config";
import http from "http";
import { pathToFileURL } from "node:url";
import app from "./app.js";
import { prisma } from "./db/client.js";
import { setNotificationDelivery } from "./modules/notifications/index.js";
import { validateIdentityConfiguration } from "./modules/identity/index.js";
import {
  installProcessSignalHandlers,
  listenHttpServer,
  log,
  logReady,
  logStartup,
} from "./platform/observability/index.js";
import { setupSocket } from "./socket.js";

const PORT = Number(process.env.PORT ?? 3000);

export async function startApplication(): Promise<http.Server> {
  validateIdentityConfiguration();
  logStartup();
  const httpServer = http.createServer(app);
  const io = setupSocket(httpServer);
  app.set("io", io);
  setNotificationDelivery((notification) => {
    io.to("user:" + notification.userId).emit("notification", notification);
  });

  installProcessSignalHandlers(
    {
      httpServer,
      io,
      disconnectDatabase: () => prisma.$disconnect(),
    },
    { exit: (code) => process.exit(code) },
  );

  await listenHttpServer(httpServer, PORT);
  logReady(PORT);
  return httpServer;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startApplication().catch((error) => {
    const errorName = error instanceof Error && /^[A-Za-z][A-Za-z0-9._]{0,63}$/.test(error.name)
      ? error.name
      : undefined;
    log.error({ event: "process.startup.failure", failureCategory: "unknown", errorName });
    process.exit(1);
  });
}
