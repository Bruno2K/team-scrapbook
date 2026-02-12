import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/db/client";

describe("Scraps", () => {
  const nick1 = "scrap_from_" + Date.now();
  const nick2 = "scrap_to_" + Date.now();
  let token1: string;
  let userId2: string;

  beforeAll(async () => {
    const r1 = await request(app).post("/auth/register").send({ name: "From User", nickname: nick1, password: "pass123" });
    const r2 = await request(app).post("/auth/register").send({ name: "To User", nickname: nick2, password: "pass123" });
    token1 = r1.body.token;
    userId2 = r2.body.user.id;
  });

  afterAll(async () => {
    await prisma.scrapMessage.deleteMany({});
    await prisma.user.deleteMany({ where: { nickname: { in: [nick1, nick2] } } });
  });

  it("GET /scraps returns 401 without token", async () => {
    const res = await request(app).get("/scraps");
    expect(res.status).toBe(401);
  });

  it("GET /scraps returns 200 and array with token", async () => {
    const res = await request(app).get("/scraps").set("Authorization", `Bearer ${token1}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST /scraps creates scrap and returns 201", async () => {
    const res = await request(app)
      .post("/scraps")
      .set("Authorization", `Bearer ${token1}`)
      .send({ toUserId: userId2, content: "Hello from scrap test!" });
    expect(res.status).toBe(201);
    expect(res.body.content).toBe("Hello from scrap test!");
    expect(res.body.from.nickname).toBe(nick1);
  });
});
