import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app";

describe("GET /health", () => {
  it("returns 200 and health payload", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "ok",
      service: "team-scrapbook-api",
    });
    expect(res.body).toHaveProperty("timestamp");
  });

  it("reports PostgreSQL readiness separately", async () => {
    const res = await request(app).get("/health/ready");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "ready",
      service: "team-scrapbook-api",
      checks: { database: "ready" },
    });
    expect(res.body).toHaveProperty("timestamp");
  });
});
