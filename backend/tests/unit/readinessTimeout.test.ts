import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import app from "../../src/app";
import { resetReadinessCache } from "../../src/platform/observability/index.js";

const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("../../src/db/client", () => ({
  prisma: { $queryRaw: mocks.queryRaw },
}));

describe("readiness timeout classification", () => {
  beforeEach(() => {
    resetReadinessCache();
    mocks.queryRaw.mockReset();
    vi.stubEnv("READINESS_TIMEOUT_MS", "20");
  });

  it("returns 503 when the PostgreSQL probe hangs past the bound", async () => {
    mocks.queryRaw.mockImplementation(() => new Promise(() => undefined));
    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "unavailable", checks: { database: "unavailable" } });
    expect(JSON.stringify(res.body)).not.toContain("timeout");
  });
});
