import { log } from "./logger.js";
import { recordDependency } from "./metrics.js";

export type DependencyName = "postgresql" | "steam" | "gemini" | "r2";
export type FailureCategory =
  | "none"
  | "timeout"
  | "network"
  | "http_4xx"
  | "http_5xx"
  | "rate_limited"
  | "not_configured"
  | "conflict"
  | "unknown";

export function classifyHttpFailure(status: number): FailureCategory {
  if (status === 429) return "rate_limited";
  if (status >= 500) return "http_5xx";
  if (status >= 400) return "http_4xx";
  return "unknown";
}

export function classifyUnknownFailure(error: unknown): FailureCategory {
  const message = error instanceof Error ? error.message : String(error);
  if (/not (set|configured)|is not set/i.test(message)) return "not_configured";
  if (/timeout|timed out|ABORT_ERR/i.test(message)) return "timeout";
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(message)) return "network";
  if (/\b429\b|Too Many Requests|quota/i.test(message)) return "rate_limited";
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: number }).status)
    : NaN;
  if (Number.isFinite(status)) return classifyHttpFailure(status);
  return "unknown";
}

export async function observeDependency<T>(
  dependency: DependencyName,
  work: () => Promise<T>,
  classify: (error: unknown) => FailureCategory = classifyUnknownFailure,
): Promise<T> {
  const started = process.hrtime.bigint();
  try {
    const result = await work();
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    recordDependency({
      dependency,
      outcome: "success",
      failureCategory: "none",
      durationMs,
    });
    log.debug({
      event: "dependency.call",
      dependency,
      outcome: "success",
      failureCategory: "none",
      durationMs: Math.round(durationMs * 100) / 100,
    });
    return result;
  } catch (error) {
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    const failureCategory = classify(error);
    recordDependency({
      dependency,
      outcome: "failure",
      failureCategory,
      durationMs,
    });
    const errorName = error instanceof Error && /^[A-Za-z][A-Za-z0-9._]{0,63}$/.test(error.name)
      ? error.name
      : undefined;
    log.warn({
      event: "dependency.call",
      dependency,
      outcome: "failure",
      failureCategory,
      durationMs: Math.round(durationMs * 100) / 100,
      errorName,
    });
    throw error;
  }
}
