import type { User } from "@/lib/types";
import { apiRequest, isApiConfigured } from "./client";
import { getStoredToken } from "./auth";

export async function getMe(): Promise<User | null> {
  if (!isApiConfigured() || !getStoredToken()) return null;
  try {
    return await apiRequest<User>("/users/me");
  } catch {
    return null;
  }
}

export async function updatePinnedAchievements(achievementIds: string[]): Promise<User> {
  return apiRequest<User>("/users/me/pinned-achievements", {
    method: "PATCH",
    body: JSON.stringify({ achievementIds }),
  });
}
