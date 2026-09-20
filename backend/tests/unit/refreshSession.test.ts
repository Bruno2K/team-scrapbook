import { afterEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { createIdentityApplication } from "../../src/modules/identity/application/identityApplication.js";
import {
  ACCESS_TOKEN_TTL,
  REFRESH_COOKIE_PATH,
  REFRESH_SESSION_TTL_MS,
  generateRefreshToken,
  hashRefreshToken,
  isRefreshSessionActive,
  readNamedCookie,
  refreshCookieOptions,
  refreshSessionExpiresAt,
} from "../../src/modules/identity/application/refreshToken.js";
import { jwtIdentityTokenCodec } from "../../src/modules/identity/integration/jwtIdentityTokenCodec.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalJwtSecret = process.env.JWT_SECRET;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

describe("refresh token hashing", () => {
  it("hashes opaque tokens and does not return the raw value", () => {
    const raw = generateRefreshToken();
    const hash = hashRefreshToken(raw);
    expect(raw).not.toBe(hash);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRefreshToken(raw)).toBe(hash);
    expect(hashRefreshToken(`${raw}x`)).not.toBe(hash);
  });
});

describe("refresh expiry and revocation", () => {
  it("treats future unrevoked sessions as active and expired or revoked sessions as inactive", () => {
    const now = new Date("2026-09-20T12:00:00.000Z");
    expect(isRefreshSessionActive({ expiresAt: new Date(now.getTime() + 1), revokedAt: null }, now)).toBe(true);
    expect(isRefreshSessionActive({ expiresAt: now, revokedAt: null }, now)).toBe(false);
    expect(isRefreshSessionActive({
      expiresAt: new Date(now.getTime() + 60_000),
      revokedAt: now,
    }, now)).toBe(false);
    expect(refreshSessionExpiresAt(now).getTime()).toBe(now.getTime() + REFRESH_SESSION_TTL_MS);
  });

  it("issues a new access token for an active session and rejects expired or revoked hashes", async () => {
    process.env.JWT_SECRET = "unit-test-secret-for-refresh-session";
    const now = new Date("2026-09-20T12:00:00.000Z");
    const stored = {
      id: "session-1",
      userId: "user-1",
      expiresAt: new Date(now.getTime() + 60_000),
      revokedAt: null as Date | null,
    };
    const repository = {
      findActorById: vi.fn(async () => ({ id: "user-1", isAiManaged: false })),
      createRefreshSession: vi.fn(async () => undefined),
      findRefreshSessionByTokenHash: vi.fn(async () => stored),
      revokeRefreshSessionByTokenHash: vi.fn(async () => undefined),
    };
    const application = createIdentityApplication(repository, jwtIdentityTokenCodec);

    const created = await application.createRefreshSession("user-1", now);
    expect(repository.createRefreshSession).toHaveBeenCalledWith({
      userId: "user-1",
      tokenHash: hashRefreshToken(created.rawToken),
      expiresAt: refreshSessionExpiresAt(now),
    });

    const refreshed = await application.refreshAccessToken(created.rawToken, now);
    expect(refreshed?.accessToken).toBeTruthy();
    const payload = jwt.decode(refreshed!.accessToken) as jwt.JwtPayload;
    expect(payload.exp! - payload.iat!).toBe(15 * 60);

    stored.expiresAt = now;
    expect(await application.refreshAccessToken(created.rawToken, now)).toBeNull();
    stored.expiresAt = new Date(now.getTime() + 60_000);
    stored.revokedAt = now;
    expect(await application.refreshAccessToken(created.rawToken, now)).toBeNull();

    await application.revokeRefreshToken(created.rawToken, now);
    expect(repository.revokeRefreshSessionByTokenHash).toHaveBeenCalledWith(hashRefreshToken(created.rawToken), now);
  });
});

describe("refresh cookie option policy", () => {
  it("uses host-only HttpOnly Lax cookies scoped to /auth", () => {
    expect(refreshCookieOptions("production")).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: REFRESH_COOKIE_PATH,
      maxAge: REFRESH_SESSION_TTL_MS,
    });
    expect(refreshCookieOptions("development")).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/auth",
    });
    expect(JSON.stringify(refreshCookieOptions("production"))).not.toMatch(/domain/i);
  });

  it("reads the named cookie without exposing other cookies", () => {
    expect(readNamedCookie("refresh_token=abc; other=1", "refresh_token")).toBe("abc");
    expect(readNamedCookie("other=1", "refresh_token")).toBeUndefined();
    expect(readNamedCookie(undefined, "refresh_token")).toBeUndefined();
  });
});

describe("access JWT issuance TTL", () => {
  it("issues 15-minute access tokens without weakening HS256 verification", () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "unit-test-secret-for-refresh-session";
    const token = jwtIdentityTokenCodec.sign("user-1", "access", ACCESS_TOKEN_TTL);
    const payload = jwt.decode(token) as jwt.JwtPayload;
    expect(payload.exp! - payload.iat!).toBe(15 * 60);
    expect(jwtIdentityTokenCodec.verify(token, "access")).toEqual({ userId: "user-1" });
    expect(() => jwtIdentityTokenCodec.verify(token, "steam-link")).toThrow();
  });
});
