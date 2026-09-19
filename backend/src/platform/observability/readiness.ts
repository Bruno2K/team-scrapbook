import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client.js";
import { log } from "./logger.js";
import { recordDependency, setReadinessMetric } from "./metrics.js";

const READINESS_TTL_MS = 5_000;

async function readinessTimeoutMs(): Promise<number> {
  const parsed = Number(process.env.READINESS_TIMEOUT_MS ?? 1500);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1500;
}

let readinessCache: { ready: boolean; expiresAt: number } | undefined;
let readinessProbe: Promise<boolean> | undefined;

async function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function probeDatabase(): Promise<boolean> {
  const started = process.hrtime.bigint();
  try {
    await withTimeout(prisma.$queryRaw(Prisma.sql`SELECT 1`), await readinessTimeoutMs());
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    recordDependency({
      dependency: "postgresql",
      outcome: "success",
      failureCategory: "none",
      durationMs,
    });
    return true;
  } catch (error) {
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    const timedOut = typeof error === "object" && error !== null && "code" in error && error.code === "ETIMEDOUT";
    recordDependency({
      dependency: "postgresql",
      outcome: "failure",
      failureCategory: timedOut ? "timeout" : "unknown",
      durationMs,
    });
    log.warn({
      event: "dependency.call",
      dependency: "postgresql",
      outcome: "failure",
      failureCategory: timedOut ? "timeout" : "unknown",
      durationMs: Math.round(durationMs * 100) / 100,
    });
    return false;
  }
}

export async function isDatabaseReady(): Promise<boolean> {
  const now = Date.now();
  if (readinessCache && readinessCache.expiresAt > now) return readinessCache.ready;

  if (!readinessProbe) {
    readinessProbe = probeDatabase().finally(() => {
      readinessProbe = undefined;
    });
  }

  const ready = await readinessProbe;
  readinessCache = { ready, expiresAt: Date.now() + READINESS_TTL_MS };
  setReadinessMetric(ready);
  return ready;
}

export function resetReadinessCache(): void {
  readinessCache = undefined;
  readinessProbe = undefined;
}
