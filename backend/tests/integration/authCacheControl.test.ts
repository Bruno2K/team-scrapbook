import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { prisma } from "../../src/db/client.js";

const allowedOrigin = "http://localhost:8080";
const nickname = `cachectrl_${Date.now()}_${Math.random().toString(16).slice(2)}`;
const password = "password123";

function cacheControl(res: { headers: Record<string, string> }): string {
  return res.headers["cache-control"] ?? "";
}

describe("auth Cache-Control success paths", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { nickname } });
  });

  it("sets no-store on login success and refresh success", async () => {
    const register = await request(app).post("/auth/register").send({
      name: "Cache Control",
      nickname,
      password,
    });
    expect(register.status).toBe(201);
    expect(cacheControl(register)).toBe("no-store");

    const login = await request(app).post("/auth/login").send({ nickname, password });
    expect(login.status).toBe(200);
    expect(cacheControl(login)).toBe("no-store");

    const cookie = Array.isArray(login.headers["set-cookie"])
      ? login.headers["set-cookie"].find((value) => value.startsWith("refresh_token="))
      : login.headers["set-cookie"];
    expect(cookie).toBeTruthy();

    const refresh = await request(app)
      .post("/auth/refresh")
      .set("Origin", allowedOrigin)
      .set("Cookie", String(cookie).split(";")[0]);
    expect(refresh.status).toBe(200);
    expect(cacheControl(refresh)).toBe("no-store");
  });
});
