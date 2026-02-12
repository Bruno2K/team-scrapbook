import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/db/client";

describe("Feed", () => {
  const nickname = "feeduser_" + Date.now();
  let token: string;
  let userId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({
        name: "Feed User",
        nickname,
        password: "password123",
      });
    token = res.body.token;
    userId = res.body.user.id;
  });

  afterAll(async () => {
    await prisma.feedItem.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { nickname } });
  });

  describe("GET /feed", () => {
    it("returns 200 and array (empty or with items)", async () => {
      const res = await request(app).get("/feed");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("returns feed items with user and timestamp", async () => {
      await request(app)
        .post("/feed")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Integration test post" });

      const res = await request(app).get("/feed");
      expect(res.status).toBe(200);
      const item = res.body.find((i: { content: string }) => i.content === "Integration test post");
      expect(item).toBeDefined();
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("user");
      expect(item.user).toMatchObject({ nickname, name: "Feed User" });
      expect(item).toHaveProperty("timestamp");
      expect(item.type).toBe("post");
    });
  });

  describe("POST /feed", () => {
    it("returns 401 without token", async () => {
      const res = await request(app)
        .post("/feed")
        .send({ content: "No auth" });
      expect(res.status).toBe(401);
    });

    it("returns 400 when content is empty", async () => {
      const res = await request(app)
        .post("/feed")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "" });
      expect(res.status).toBe(400);
    });

    it("returns 201 and created item with valid token and content", async () => {
      const res = await request(app)
        .post("/feed")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "New intel from test" });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        content: "New intel from test",
        type: "post",
      });
      expect(res.body.user).toMatchObject({ nickname });
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("timestamp");
    });
  });
});
