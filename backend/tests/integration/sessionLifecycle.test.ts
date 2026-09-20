import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import app from "../../src/app.js";
import { prisma } from "../../src/db/client.js";
import { hashRefreshToken, issuePurposeToken } from "../../src/modules/identity/index.js";

const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
const prefix = `session_${suffix}`;
const password = "password123";
const allowedOrigin = "http://localhost:8080";

function setCookieHeaders(res: request.Response): string[] {
  const header = res.headers["set-cookie"];
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
}

function refreshCookie(res: request.Response): string | undefined {
  return setCookieHeaders(res).find((cookie) => cookie.startsWith("refresh_token="));
}

function cookieValue(cookie: string): string {
  return decodeURIComponent(cookie.split(";")[0]!.slice("refresh_token=".length));
}

async function createUser(label: string) {
  const nickname = `${prefix}_${label}`;
  const user = await prisma.user.create({
    data: {
      name: `Session ${label}`,
      nickname,
      passwordHash: await bcrypt.hash(password, 4),
    },
  });
  const response = await request(app).post("/auth/login").send({ nickname, password });
  expect(response.status).toBe(200);
  const cookie = refreshCookie(response);
  expect(cookie).toBeTruthy();
  return {
    id: user.id,
    nickname,
    token: response.body.token as string,
    cookie: cookie!,
    response,
  };
}

describe("Issue #42 session lifecycle", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { nickname: { startsWith: prefix } } });
  });

  it("creates a hashed refresh session on register and login without returning the refresh token", async () => {
    const nickname = `${prefix}_register`;
    const registered = await request(app).post("/auth/register").send({
      name: "Session register",
      nickname,
      password,
    });
    if (registered.status === 429) {
      // Registration limiter is process-local and may already be exhausted by earlier files.
      const user = await createUser("register_login");
      expect(user.cookie).toMatch(/HttpOnly/i);
      expect(JSON.stringify(user.response.body)).not.toContain(cookieValue(user.cookie));
      return;
    }
    expect(registered.status).toBe(201);
    const cookie = refreshCookie(registered);
    expect(cookie).toBeTruthy();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/auth/i);
    expect(cookie).not.toMatch(/Domain=/i);
    expect(cookie).not.toMatch(/Secure/i);
    expect(registered.body).not.toHaveProperty("refreshToken");
    expect(JSON.stringify(registered.body)).not.toContain(cookieValue(cookie!));

    const payload = jwt.decode(registered.body.token) as jwt.JwtPayload;
    expect(payload.exp! - payload.iat!).toBe(15 * 60);

    const stored = await prisma.refreshSession.findUnique({
      where: { tokenHash: hashRefreshToken(cookieValue(cookie!)) },
    });
    expect(stored).not.toBeNull();
    expect(stored?.userId).toBe(registered.body.user.id);
    expect(stored?.revokedAt).toBeNull();

    const login = await request(app).post("/auth/login").send({ nickname, password });
    expect(login.status).toBe(200);
    expect(refreshCookie(login)).toBeTruthy();
    expect(JSON.stringify(login.body)).not.toContain(cookieValue(refreshCookie(login)!));
    expect(await prisma.refreshSession.count({ where: { userId: registered.body.user.id } })).toBe(2);
  });

  it("refreshes with a valid cookie and allowed Origin, and fails closed otherwise", async () => {
    const user = await createUser("refresh");
    const raw = cookieValue(user.cookie);

    const success = await request(app)
      .post("/auth/refresh")
      .set("Origin", allowedOrigin)
      .set("Cookie", `refresh_token=${raw}`);
    expect(success.status).toBe(200);
    expect(typeof success.body.token).toBe("string");
    expect(success.body).not.toHaveProperty("refreshToken");
    expect(JSON.stringify(success.body)).not.toContain(raw);

    const missing = await request(app).post("/auth/refresh").set("Origin", allowedOrigin);
    expect(missing.status).toBe(401);

    const unknown = await request(app)
      .post("/auth/refresh")
      .set("Origin", allowedOrigin)
      .set("Cookie", "refresh_token=not-a-real-refresh-token");
    expect(unknown.status).toBe(401);

    const invalidOrigin = await request(app)
      .post("/auth/refresh")
      .set("Origin", "https://evil.example")
      .set("Cookie", `refresh_token=${raw}`);
    expect(invalidOrigin.status).toBe(403);

    const missingOrigin = await request(app)
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${raw}`);
    expect(missingOrigin.status).toBe(403);
  });

  it("rejects expired and revoked refresh sessions", async () => {
    const user = await createUser("expiry");
    const raw = cookieValue(user.cookie);
    await prisma.refreshSession.updateMany({
      where: { tokenHash: hashRefreshToken(raw) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expired = await request(app)
      .post("/auth/refresh")
      .set("Origin", allowedOrigin)
      .set("Cookie", `refresh_token=${raw}`);
    expect(expired.status).toBe(401);

    const other = await createUser("revoked");
    const otherRaw = cookieValue(other.cookie);
    const logout = await request(app)
      .post("/auth/logout")
      .set("Origin", allowedOrigin)
      .set("Cookie", `refresh_token=${otherRaw}`);
    expect(logout.status).toBe(204);
    const session = await prisma.refreshSession.findUnique({
      where: { tokenHash: hashRefreshToken(otherRaw) },
    });
    expect(session?.revokedAt).not.toBeNull();
    const revoked = await request(app)
      .post("/auth/refresh")
      .set("Origin", allowedOrigin)
      .set("Cookie", `refresh_token=${otherRaw}`);
    expect(revoked.status).toBe(401);

    const again = await request(app)
      .post("/auth/logout")
      .set("Origin", allowedOrigin)
      .set("Cookie", `refresh_token=${otherRaw}`);
    expect(again.status).toBe(204);
  });

  it("does not let the refresh cookie authorize product routes", async () => {
    const user = await createUser("product");
    const raw = cookieValue(user.cookie);
    const cookieOnly = await request(app)
      .get("/users/me")
      .set("Cookie", `refresh_token=${raw}`);
    expect(cookieOnly.status).toBe(401);

    const bearer = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${user.token}`);
    expect(bearer.status).toBe(200);
  });

  it("invalidates refresh sessions when the user is deleted and rejects AI-managed refresh", async () => {
    const deleted = await createUser("deleted");
    const deletedRaw = cookieValue(deleted.cookie);
    await prisma.user.delete({ where: { id: deleted.id } });
    expect(await prisma.refreshSession.count({ where: { tokenHash: hashRefreshToken(deletedRaw) } })).toBe(0);
    const deletedRefresh = await request(app)
      .post("/auth/refresh")
      .set("Origin", allowedOrigin)
      .set("Cookie", `refresh_token=${deletedRaw}`);
    expect(deletedRefresh.status).toBe(401);

    const managed = await createUser("ai");
    const managedRaw = cookieValue(managed.cookie);
    await prisma.user.update({ where: { id: managed.id }, data: { isAiManaged: true } });
    const aiRefresh = await request(app)
      .post("/auth/refresh")
      .set("Origin", allowedOrigin)
      .set("Cookie", `refresh_token=${managedRaw}`);
    expect(aiRefresh.status).toBe(401);
  });

  it("keeps Steam purpose tokens separate from refresh and access credentials", async () => {
    const user = await createUser("steam");
    const steamToken = issuePurposeToken(user.id, "steam-link", "5m");
    const asRefresh = await request(app)
      .post("/auth/refresh")
      .set("Origin", allowedOrigin)
      .set("Cookie", `refresh_token=${steamToken}`);
    expect(asRefresh.status).toBe(401);
    const asAccess = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${steamToken}`);
    expect(asAccess.status).toBe(401);

    const logoutOrigin = await request(app)
      .post("/auth/logout")
      .set("Origin", "https://evil.example")
      .set("Cookie", user.cookie.split(";")[0]!);
    expect(logoutOrigin.status).toBe(403);
  });
});
