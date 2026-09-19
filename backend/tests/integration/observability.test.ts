import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app";

describe("HTTP observability integration", () => {
  it("propagates a request id on process health without querying product data", async () => {
    const res = await request(app).get("/health").set("X-Request-Id", "integ-corr-1");
    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBe("integ-corr-1");
    expect(res.body).toMatchObject({ status: "ok", service: "team-scrapbook-api" });
    expect(res.body.release).toHaveProperty("gitSha");
  });

  it("exposes process-local prometheus metrics with bounded labels", async () => {
    await request(app).get("/health");
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.text).toContain("http_requests_total");
    expect(res.text).toContain('route="/health"');
    expect(res.text).not.toContain("userId=");
    expect(res.text).not.toContain("requestId=");
  });
});
