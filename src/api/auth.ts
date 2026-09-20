import type { User } from "@/lib/types";
import { apiRequest, isApiConfigured, renewAccessToken } from "./client";
import {
  clearAccessToken,
  completeAuthBootstrap,
  discardLegacyAccessTokenStorage,
  getAccessToken,
  getBootstrapState,
  publishAuthEvent,
  setAccessToken,
} from "@/auth/session";

export function getStoredToken(): string | null {
  return getAccessToken();
}

/** Decode JWT payload to get current user id (for UI only; backend verifies). */
export function getCurrentUserId(): string | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const raw = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(raw);
    const payload = JSON.parse(json) as { userId?: string; sub?: string };
    return payload.userId ?? payload.sub ?? null;
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  setAccessToken(token);
}

export function clearStoredToken(): void {
  clearAccessToken();
}

export interface LoginInput {
  nickname: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

function rememberAccessToken(token: string): void {
  setAccessToken(token);
  completeAuthBootstrap();
  publishAuthEvent({ type: "session-refreshed" });
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  if (!isApiConfigured()) {
    throw new Error("API não configurada. Defina VITE_API_URL no .env");
  }
  const res = await apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  rememberAccessToken(res.token);
  return res;
}

export async function logout(): Promise<void> {
  try {
    if (isApiConfigured()) {
      await apiRequest("/auth/logout", { method: "POST" });
    }
  } catch {
    // Local session still clears so the UI cannot remain authenticated.
  } finally {
    clearAccessToken();
    publishAuthEvent({ type: "logout" });
  }
}

export interface RegisterInput {
  name: string;
  nickname: string;
  password: string;
  team?: "RED" | "BLU";
  mainClass?: string;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  if (!isApiConfigured()) {
    throw new Error("API não configurada. Defina VITE_API_URL no .env");
  }
  const res = await apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
  rememberAccessToken(res.token);
  return res;
}

export async function recoverSessionFromCookie(): Promise<boolean> {
  if (!isApiConfigured()) return false;
  const token = await renewAccessToken();
  return Boolean(token);
}

export async function bootstrapAuthSession(): Promise<"authenticated" | "unauthenticated"> {
  if (getBootstrapState() === "ready") {
    return getAccessToken() ? "authenticated" : "unauthenticated";
  }
  discardLegacyAccessTokenStorage();
  if (!isApiConfigured()) {
    completeAuthBootstrap();
    return "unauthenticated";
  }
  const recovered = await recoverSessionFromCookie();
  if (!recovered && !getAccessToken()) {
    clearAccessToken();
  }
  completeAuthBootstrap();
  return getAccessToken() ? "authenticated" : "unauthenticated";
}
