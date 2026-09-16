import type { User } from "@/lib/types";
import { apiRequest, isApiConfigured } from "./client";
import { getStoredToken } from "./auth";

/** Request a short-lived, purpose-scoped Steam OpenID redirect URL. */
export async function getSteamAuthRedirectUrl(): Promise<string> {
  if (!isApiConfigured() || !getStoredToken()) {
    throw new Error("Faça login para vincular sua conta Steam.");
  }
  const result = await apiRequest<{ url: string }>("/users/me/steam/auth-url", { method: "POST" });
  return result.url;
}

/** Link Steam by SteamID64 or vanity URL (Opção A). Returns updated user. */
export async function linkSteam(body: { steamId64?: string; vanityUrl?: string }): Promise<User> {
  return apiRequest<User>("/users/me/steam-link", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Unlink Steam account. Returns updated user. */
export async function unlinkSteam(): Promise<User> {
  return apiRequest<User>("/users/me/steam/unlink", { method: "POST" });
}

/** Sync Steam games and achievements. Returns updated user and sync stats. */
export async function syncSteam(): Promise<User & { steamSync?: { gamesCount: number; achievementsCount: number } }> {
  return apiRequest<User & { steamSync?: { gamesCount: number; achievementsCount: number } }>(
    "/users/me/steam/sync",
    { method: "POST" }
  );
}
