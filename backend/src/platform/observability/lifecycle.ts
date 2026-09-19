import http from "node:http";
import type { Server as SocketServer } from "socket.io";
import { log } from "./logger.js";
import { getReleaseIdentity, sanitizedRuntimeConfig } from "./release.js";

export const SHUTDOWN_TIMEOUT_MS = 10_000;

export interface ManagedProcess {
  httpServer?: http.Server;
  io?: Pick<SocketServer, "close">;
  stopWorkers?: () => Promise<void>;
  disconnectDatabase: () => Promise<void>;
}

export interface ShutdownOptions {
  signal?: string;
  timeoutMs?: number;
  exit?: (code: number) => void;
}

let shuttingDown = false;
let installedHandlers = false;
let sigtermHandler: (() => void) | undefined;
let sigintHandler: (() => void) | undefined;

export function resetLifecycleState(): void {
  shuttingDown = false;
  if (sigtermHandler) process.removeListener("SIGTERM", sigtermHandler);
  if (sigintHandler) process.removeListener("SIGINT", sigintHandler);
  sigtermHandler = undefined;
  sigintHandler = undefined;
  installedHandlers = false;
}

export function isShuttingDown(): boolean {
  return shuttingDown;
}

function closeHttpServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING") {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function closeSockets(io: Pick<SocketServer, "close">): Promise<void> {
  return new Promise((resolve) => {
    io.close(() => resolve());
  });
}

async function disconnectSafely(disconnectDatabase: () => Promise<void>): Promise<void> {
  try {
    await disconnectDatabase();
  } catch {
    log.warn({ event: "process.shutdown.database", outcome: "failure", failureCategory: "unknown" });
  }
}

export async function shutdownProcess(managed: ManagedProcess, options: ShutdownOptions = {}): Promise<"completed" | "timeout" | "skipped"> {
  if (shuttingDown) return "skipped";
  shuttingDown = true;
  const timeoutMs = options.timeoutMs ?? SHUTDOWN_TIMEOUT_MS;
  log.info({
    event: "process.shutdown.initiated",
    signal: options.signal,
  });

  let reachedDatabase = false;
  const work = (async () => {
    if (managed.stopWorkers) {
      await managed.stopWorkers();
    }
    if (managed.httpServer && typeof managed.httpServer.closeAllConnections === "function") {
      managed.httpServer.closeAllConnections();
    }
    if (managed.io) {
      await closeSockets(managed.io);
    }
    if (managed.httpServer) {
      await closeHttpServer(managed.httpServer);
    }
    reachedDatabase = true;
    await disconnectSafely(managed.disconnectDatabase);
  })();

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("shutdown timeout"), { code: "SHUTDOWN_TIMEOUT" })), timeoutMs);
      }),
    ]);
    log.info({ event: "process.shutdown.completed" });
    options.exit?.(0);
    return "completed";
  } catch {
    log.error({
      event: "process.shutdown.failure",
      failureCategory: "timeout",
    });
    if (!reachedDatabase) {
      void disconnectSafely(managed.disconnectDatabase);
    }
    options.exit?.(1);
    return "timeout";
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function installProcessSignalHandlers(managed: ManagedProcess, options: Omit<ShutdownOptions, "signal"> = {}): void {
  if (installedHandlers) return;
  installedHandlers = true;
  sigtermHandler = () => {
    void shutdownProcess(managed, { ...options, signal: "SIGTERM" });
  };
  sigintHandler = () => {
    void shutdownProcess(managed, { ...options, signal: "SIGINT" });
  };
  process.on("SIGTERM", sigtermHandler);
  process.on("SIGINT", sigintHandler);
}

export function listenHttpServer(httpServer: http.Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, "0.0.0.0", () => {
      httpServer.removeListener("error", reject);
      resolve();
    });
  });
}

export function logStartup(): void {
  const release = getReleaseIdentity();
  const config = sanitizedRuntimeConfig();
  log.info({
    event: "process.startup",
    gitSha: release.gitSha,
    deploymentId: release.deploymentId,
    nodeEnv: config.nodeEnv,
    port: Number(config.port),
    corsOriginConfigured: config.corsOriginConfigured,
    jwtConfigured: config.jwtConfigured,
    databaseConfigured: config.databaseConfigured,
    steamConfigured: config.steamConfigured,
    geminiConfigured: config.geminiConfigured,
    r2Configured: config.r2Configured,
  });
}

export function logReady(port: number): void {
  log.info({
    event: "process.ready",
    port,
    ready: true,
  });
}
