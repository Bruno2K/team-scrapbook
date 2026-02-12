import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app";

describe("GET /communities", () => {
  it("returns 200 and array of communities", async () => {
    const res = await request(app).get("/communities");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty("id");
      expect(res.body[0]).toHaveProperty("name");
      expect(res.body[0]).toHaveProperty("description");
      expect(res.body[0]).toHaveProperty("members");
    }
  });
});
