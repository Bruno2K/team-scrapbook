function releaseMetadata() {
  return {
    gitSha: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? null,
    deploymentId: process.env.RAILWAY_DEPLOYMENT_ID ?? null,
  };
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
