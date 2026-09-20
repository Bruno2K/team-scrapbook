import { createHash, randomBytes } from "node:crypto";

export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const REFRESH_COOKIE_NAME = "refresh_token";
export const REFRESH_COOKIE_PATH = "/auth";

export interface RefreshCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: typeof REFRESH_COOKIE_PATH;
  maxAge: number;
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function refreshSessionExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + REFRESH_SESSION_TTL_MS);
}

export function isRefreshSessionActive(
  session: { expiresAt: Date; revokedAt: Date | null },
  now = new Date(),
): boolean {
  if (session.revokedAt) return false;
  return session.expiresAt.getTime() > now.getTime();
}

export function refreshCookieOptions(nodeEnv = process.env.NODE_ENV): RefreshCookieOptions {
  return {
    httpOnly: true,
    secure: nodeEnv === "production",
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_SESSION_TTL_MS,
  };
}

export function readNamedCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return part.slice(separator + 1).trim();
    }
  }
  return undefined;
}
