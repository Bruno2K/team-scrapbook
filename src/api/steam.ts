import type { User } from "@/lib/types";
import { apiRequest, isApiConfigured } from "./client";
import { getStoredToken } from "./auth";

const baseURL = import.meta.env.VITE_API_URL ?? "";

/** Get the URL to redirect the user to for Steam OpenID (link account). Browser redirect cannot send Bearer; token is passed in query. */
export function getSteamAuthRedirectUrl(): string {
  const token = getStoredToken();
  if (!isApiConfigured() || !token) {
    throw new Error("Faça login para vincular sua conta Steam.");
  }
  const base = baseURL.replace(/\/$/, "");
  return `${base}/users/me/steam/auth?token=${encodeURIComponent(token)}`;
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
