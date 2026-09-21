import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app.js";

const allowedOrigin = "http://localhost:8080";

function cacheControl(res: { headers: Record<string, string> }): string {
  return res.headers["cache-control"] ?? "";
}

describe("auth Cache-Control", () => {
  it("sets no-store on login 4xx, refresh failure, and logout 204", async () => {
    const loginInvalid = await request(app).post("/auth/login").send({});
    expect(loginInvalid.status).toBe(400);
    expect(cacheControl(loginInvalid)).toBe("no-store");

    const refreshMissingOrigin = await request(app).post("/auth/refresh");
    expect(refreshMissingOrigin.status).toBe(403);
    expect(cacheControl(refreshMissingOrigin)).toBe("no-store");

    const refreshInvalidSession = await request(app)
      .post("/auth/refresh")
      .set("Origin", allowedOrigin);
    expect(refreshInvalidSession.status).toBe(401);
    expect(cacheControl(refreshInvalidSession)).toBe("no-store");

    const logout = await request(app)
      .post("/auth/logout")
      .set("Origin", allowedOrigin);
    expect(logout.status).toBe(204);
    expect(cacheControl(logout)).toBe("no-store");
  });
});
