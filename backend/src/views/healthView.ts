import { getReleaseIdentity } from "../platform/observability/index.js";

function releaseMetadata() {
  return getReleaseIdentity();
}

export function healthToJSON() {
  return {
    status: "ok",
    service: "team-scrapbook-api",
    timestamp: new Date().toISOString(),
    release: releaseMetadata(),
  };
}

export function readinessToJSON(database: "ready" | "unavailable") {
  return {
    status: database === "ready" ? "ready" : "unavailable",
    service: "team-scrapbook-api",
    timestamp: new Date().toISOString(),
    checks: { database },
    release: releaseMetadata(),
  };
}
