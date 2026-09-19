import { getReleaseIdentity } from "./release.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface StructuredLogFields {
  event: string;
  requestId?: string;
  method?: string;
  route?: string;
  status?: number;
  durationMs?: number;
  dependency?: string;
  outcome?: "success" | "failure";
  failureCategory?: string;
  retry?: boolean;
  retryClassification?: string;
  socketId?: string;
  disconnectReason?: string;
  signal?: string;
  gitSha?: string | null;
  deploymentId?: string | null;
  port?: number;
  nodeEnv?: string;
  corsOriginConfigured?: boolean;
  jwtConfigured?: boolean;
  databaseConfigured?: boolean;
  steamConfigured?: boolean;
  geminiConfigured?: boolean;
  r2Configured?: boolean;
  ready?: boolean;
  errorName?: string;
  errorCode?: string;
  [key: string]: string | number | boolean | null | undefined;
}

const FORBIDDEN_FIELD = /^(password|passwd|secret|token|authorization|cookie|jwt|api[_-]?key|credential|set-cookie)$/i;
const MAX_STRING = 200;

type LogWriter = (line: string) => void;

const defaultWriter: LogWriter = (line) => {
  process.stdout.write(`${line}\n`);
};

let writer: LogWriter = defaultWriter;

export function setLogWriter(next: LogWriter): void {
  writer = next;
}

export function resetLogWriter(): void {
  writer = defaultWriter;
}

function safeValue(value: string | number | boolean | null | undefined): string | number | boolean | null | undefined {
  if (typeof value !== "string") return value;
  return value.length > MAX_STRING ? value.slice(0, MAX_STRING) : value;
}

export function emitLog(level: LogLevel, fields: StructuredLogFields): Record<string, unknown> {
  const release = getReleaseIdentity();
  const record: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    event: fields.event,
    gitSha: release.gitSha,
    deploymentId: release.deploymentId,
  };

  for (const [key, value] of Object.entries(fields)) {
    if (key === "event") continue;
    if (FORBIDDEN_FIELD.test(key)) continue;
    if (value === undefined) continue;
    record[key] = safeValue(value);
  }

  writer(JSON.stringify(record));
  return record;
}

export const log = {
  debug(fields: StructuredLogFields) {
    return emitLog("debug", fields);
  },
  info(fields: StructuredLogFields) {
    return emitLog("info", fields);
  },
  warn(fields: StructuredLogFields) {
    return emitLog("warn", fields);
  },
  error(fields: StructuredLogFields) {
    return emitLog("error", fields);
  },
};
