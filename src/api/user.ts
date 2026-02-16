import type { User } from "@/lib/types";
import { apiRequest, isApiConfigured } from "./client";
import { getStoredToken } from "./auth";

export interface ProfileCommunity {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  dominantClass?: string | null;
  team?: string | null;
}

export interface UserMediaItem {
  url: string;
  type: string;
  filename?: string;
  feedItemId?: string;
  scrapId?: string;
}

export async function getMe(): Promise<User | null> {
  if (!isApiConfigured() || !getStoredToken()) return null;
  try {
    return await apiRequest<User>("/users/me");
  } catch {
    return null;
  }
}

export async function getUserById(userId: string): Promise<User | null> {
  if (!isApiConfigured()) return null;
  try {
    return await apiRequest<User>(`/users/${userId}`);
  } catch {
    return null;
  }
}

export async function getUserFeed(userId: string): Promise<import("@/lib/types").FeedItem[]> {
  if (!isApiConfigured()) return [];
  try {
    const data = await apiRequest<unknown>(`/users/${userId}/feed`);
    return Array.isArray(data) ? (data as import("@/lib/types").FeedItem[]) : [];
  } catch {
    return [];
  }
}

export async function getUserFriends(userId: string): Promise<User[]> {
  if (!isApiConfigured()) return [];
  try {
    const data = await apiRequest<unknown>(`/users/${userId}/friends`);
    return Array.isArray(data) ? (data as User[]) : [];
  } catch {
    return [];
  }
}

export async function getUserCommunities(userId: string): Promise<ProfileCommunity[]> {
  if (!isApiConfigured()) return [];
  try {
    const data = await apiRequest<unknown>(`/users/${userId}/communities`);
    return Array.isArray(data) ? (data as ProfileCommunity[]) : [];
  } catch {
    return [];
  }
}

export async function getUserMedia(userId: string): Promise<{ items: UserMediaItem[] }> {
  if (!isApiConfigured()) return { items: [] };
  try {
    const data = await apiRequest<{ items: UserMediaItem[] }>(`/users/${userId}/media`);
    return data?.items ? data : { items: [] };
  } catch {
    return { items: [] };
  }
}

export interface UpdateMePayload {
  avatar?: string | null;
  name?: string;
  nickname?: string;
  birthDate?: string | null;
  gender?: string | null;
  favoriteMap?: string | null;
  playstyle?: string | null;
  quote?: string | null;
  country?: string | null;
  bio?: string | null;
}

export async function updateMe(payload: UpdateMePayload): Promise<User> {
  return apiRequest<User>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function updatePinnedAchievements(achievementIds: string[]): Promise<User> {
  return apiRequest<User>("/users/me/pinned-achievements", {
    method: "PATCH",
    body: JSON.stringify({ achievementIds }),
  });
}

export async function updatePinnedPosts(pinnedPostIds: string[]): Promise<User> {
  return apiRequest<User>("/users/me/pinned-posts", {
    method: "PATCH",
    body: JSON.stringify({ pinnedPostIds }),
  });
}
