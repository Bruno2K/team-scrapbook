import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { healthToJSON, readinessToJSON } from "../../src/views/healthView";

describe("healthView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-02-12T12:00:00.000Z"));
    vi.stubEnv("RAILWAY_GIT_COMMIT_SHA", "candidate-sha");
    vi.stubEnv("RAILWAY_DEPLOYMENT_ID", "railway-deployment");
  });

  it("returns status ok and service name", () => {
    const result = healthToJSON();

    expect(result).toEqual({
      status: "ok",
      service: "team-scrapbook-api",
      timestamp: "2025-02-12T12:00:00.000Z",
      release: {
        gitSha: "candidate-sha",
        deploymentId: "railway-deployment",
      },
    });
  });

  it("distinguishes ready and unavailable database state", () => {
    expect(readinessToJSON("ready")).toMatchObject({
      status: "ready",
      checks: { database: "ready" },
    });
    expect(readinessToJSON("unavailable")).toMatchObject({
      status: "unavailable",
      checks: { database: "unavailable" },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });
});

