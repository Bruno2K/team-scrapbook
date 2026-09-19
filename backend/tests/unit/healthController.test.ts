import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import { resetReadinessCache } from "../../src/platform/observability/index.js";

const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("../../src/db/client", () => ({
  prisma: { $queryRaw: mocks.queryRaw },
}));

import app from "../../src/app";

describe("GET /health/ready failure", () => {
  beforeEach(() => {
    resetReadinessCache();
    mocks.queryRaw.mockReset();
  });

  it("returns a detail-free 503 and coalesces concurrent database failures", async () => {
    mocks.queryRaw.mockRejectedValueOnce(new Error("database details must not escape"));

    const [first, second] = await Promise.all([
      request(app).get("/health/ready"),
      request(app).get("/health/ready"),
    ]);

    expect(first.status).toBe(503);
    expect(second.status).toBe(503);
    expect(first.body).toMatchObject({
      status: "unavailable",
      checks: { database: "unavailable" },
    });
    expect(JSON.stringify(first.body)).not.toContain("database details must not escape");
    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
  });
});
