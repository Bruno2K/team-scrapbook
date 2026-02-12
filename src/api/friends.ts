import type { User } from "@/lib/types";
import { apiRequest, isApiConfigured } from "./client";
import { getStoredToken } from "./auth";
import { MOCK_USERS } from "@/lib/mockData";

export async function getFriends(): Promise<User[]> {
  if (!isApiConfigured() || !getStoredToken()) {
    return MOCK_USERS.slice(1);
  }
  try {
    return await apiRequest<User[]>("/users/friends");
  } catch {
    return MOCK_USERS.slice(1);
  }
}
