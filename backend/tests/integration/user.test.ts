import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/db/client";

describe("GET /users/me", () => {
  const nickname = "userme_" + Date.now();
  let token: string;

  beforeAll(async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({
        name: "Me User",
        nickname,
        password: "password123",
      });
    token = res.body.token;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { nickname } });
  });

  it("returns 401 without Authorization header", async () => {
    const res = await request(app).get("/users/me");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("message");
  });

  it("returns 401 with invalid token", async () => {
    const res = await request(app)
      .get("/users/me")
      .set("Authorization", "Bearer invalid-token");
    expect(res.status).toBe(401);
  });

  it("returns 200 and user with valid token", async () => {
    const res = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: "Me User",
      nickname,
      team: "RED",
      mainClass: "Scout",
      level: 1,
    });
    expect(res.body).not.toHaveProperty("passwordHash");
  });
});
