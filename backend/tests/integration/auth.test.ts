import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/db/client";

describe("Auth", () => {
  const testUser = {
    name: "Test User",
    nickname: "testauth_" + Date.now(),
    password: "password123",
  };

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { nickname: { startsWith: "testauth_" } } });
  });

  describe("POST /auth/register", () => {
    it("returns 201 and user + token with valid body", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("user");
      expect(res.body.user).toMatchObject({
        name: testUser.name,
        nickname: testUser.nickname,
        team: "RED",
        mainClass: "Scout",
        level: 1,
        achievements: [],
        reputation: [],
      });
      expect(res.body.user).toHaveProperty("id");
      expect(res.body).toHaveProperty("token");
      expect(typeof res.body.token).toBe("string");
    });

    it("returns 400 when nickname already exists", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send(testUser);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toContain("Nickname");
    });

    it("returns 400 when password is too short", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          name: "A",
          nickname: "short_" + Date.now(),
          password: "12345",
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message");
    });
  });

  describe("POST /auth/login", () => {
    it("returns 200 and user + token with valid credentials", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({ nickname: testUser.nickname, password: testUser.password });

      expect(res.status).toBe(200);
      expect(res.body.user.nickname).toBe(testUser.nickname);
      expect(res.body).toHaveProperty("token");
    });

    it("returns 401 with wrong password", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({ nickname: testUser.nickname, password: "wrongpassword" });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("message");
    });

    it("returns 401 with unknown nickname", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({ nickname: "nonexistent_" + Date.now(), password: "any" });

      expect(res.status).toBe(401);
    });
  });
});
