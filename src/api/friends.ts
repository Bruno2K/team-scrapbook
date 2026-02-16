import type { User } from "@/lib/types";
import { apiRequest, isApiConfigured } from "./client";
import { getStoredToken } from "./auth";

export async function getFriends(): Promise<User[]> {
  if (!isApiConfigured() || !getStoredToken()) {
    return [];
  }
  try {
    return await apiRequest<User[]>("/users/friends");
  } catch {
    return [];
  }
}

export async function getBlocked(): Promise<User[]> {
  if (!isApiConfigured() || !getStoredToken()) return [];
  try {
    return await apiRequest<User[]>("/users/blocked");
  } catch {
    return [];
  }
}

export async function getAvailableToAdd(search?: string): Promise<User[]> {
  if (!isApiConfigured() || !getStoredToken()) return [];
  try {
    const url = search?.trim()
      ? `/users/available?search=${encodeURIComponent(search.trim())}`
      : "/users/available";
    return await apiRequest<User[]>(url);
  } catch {
    return [];
  }
}

export async function getRecommendations(): Promise<User[]> {
  if (!isApiConfigured() || !getStoredToken()) return [];
  try {
    return await apiRequest<User[]>("/users/recommendations");
  } catch {
    return [];
  }
}

export interface FriendRequestItem {
  id: string;
  fromUserId: string;
  from: User;
  createdAt: string;
}

export async function getMyFriendRequests(): Promise<FriendRequestItem[]> {
  if (!isApiConfigured() || !getStoredToken()) return [];
  try {
    return await apiRequest<FriendRequestItem[]>("/users/me/friend-requests");
  } catch {
    return [];
  }
}

export async function addFriend(userId: string): Promise<{ message: string }> {
  const res = await apiRequest<{ message: string }>("/users/friends", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
  return res;
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  await apiRequest(`/users/me/friend-requests/${requestId}/accept`, { method: "POST" });
}

export async function declineFriendRequest(requestId: string): Promise<void> {
  await apiRequest(`/users/me/friend-requests/${requestId}/decline`, { method: "POST" });
}

export async function removeFriend(userId: string): Promise<void> {
  await apiRequest(`/users/friends/${userId}`, { method: "DELETE" });
}

export async function blockUser(userId: string): Promise<void> {
  await apiRequest(`/users/${userId}/block`, { method: "POST" });
}

export async function unblockUser(userId: string): Promise<void> {
  await apiRequest(`/users/${userId}/block`, { method: "DELETE" });
}
