export interface OutboxRuntimeConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  leaseMs: number;
  pollIntervalMs: number;
  batchSize: number;
  unavailableBackoffMs: number;
}

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export function readOutboxRuntimeConfig(overrides: Partial<OutboxRuntimeConfig> = {}): OutboxRuntimeConfig {
  return {
    maxAttempts: overrides.maxAttempts ?? envInt("OUTBOX_MAX_ATTEMPTS", 8, 1, 32),
    initialDelayMs: overrides.initialDelayMs ?? envInt("OUTBOX_INITIAL_DELAY_MS", 1_000, 1, 3_600_000),
    maxDelayMs: overrides.maxDelayMs ?? envInt("OUTBOX_MAX_DELAY_MS", 300_000, 1, 3_600_000),
    leaseMs: overrides.leaseMs ?? envInt("OUTBOX_LEASE_MS", 30_000, 50, 600_000),
    pollIntervalMs: overrides.pollIntervalMs ?? envInt("OUTBOX_POLL_INTERVAL_MS", 1_000, 50, 60_000),
    batchSize: overrides.batchSize ?? envInt("OUTBOX_BATCH_SIZE", 10, 1, 100),
    unavailableBackoffMs: overrides.unavailableBackoffMs
      ?? envInt("OUTBOX_UNAVAILABLE_BACKOFF_MS", 2_000, 50, 60_000),
  };
}

export function isEmbeddedOutboxWorkerEnabled(): boolean {
  return process.env.OUTBOX_WORKER_ENABLED !== "false";
}

export function retryDelayMs(attemptCount: number, config: Pick<OutboxRuntimeConfig, "initialDelayMs" | "maxDelayMs">): number {
  const exp = Math.max(0, attemptCount - 1);
  const delay = config.initialDelayMs * 2 ** exp;
  return Math.min(config.maxDelayMs, delay);
}
