import type { Community, CommunityDetail, CommunityMemberRole } from "@/lib/types";
import type { FeedItem } from "@/lib/types";
import { apiRequest, isApiConfigured } from "./client";
import { MOCK_COMMUNITIES } from "@/lib/mockData";

export async function getCommunities(): Promise<Community[]> {
  if (!isApiConfigured()) {
    return MOCK_COMMUNITIES;
  }
  try {
    return await apiRequest<Community[]>("/communities");
  } catch {
    return MOCK_COMMUNITIES;
  }
}

export async function getCommunity(id: string): Promise<CommunityDetail | null> {
  if (!isApiConfigured()) return null;
  try {
    return await apiRequest<CommunityDetail>(`/communities/${id}`);
  } catch {
    return null;
  }
}

export interface CreateCommunityInput {
  name: string;
  description: string;
  dominantClass?: string;
  team?: string;
}

export async function createCommunity(data: CreateCommunityInput): Promise<Community> {
  return apiRequest<Community>("/communities", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export interface UpdateCommunityInput {
  name?: string;
  description?: string;
  dominantClass?: string | null;
  team?: string | null;
}

export async function updateCommunity(id: string, data: UpdateCommunityInput): Promise<void> {
  await apiRequest(`/communities/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteCommunity(id: string): Promise<void> {
  await apiRequest(`/communities/${id}`, { method: "DELETE" });
}

export async function joinCommunity(id: string): Promise<void> {
  await apiRequest(`/communities/${id}/join`, { method: "POST" });
}

export async function leaveCommunity(id: string): Promise<void> {
  await apiRequest(`/communities/${id}/leave`, { method: "DELETE" });
}

export async function getCommunityMembers(id: string): Promise<CommunityMemberRole[]> {
  if (!isApiConfigured()) return [];
  try {
    return await apiRequest<CommunityMemberRole[]>(`/communities/${id}/members`);
  } catch {
    return [];
  }
}

export async function removeMember(communityId: string, userId: string): Promise<void> {
  await apiRequest(`/communities/${communityId}/members/${userId}`, { method: "DELETE" });
}

export async function getCommunityPosts(id: string): Promise<FeedItem[]> {
  if (!isApiConfigured()) return [];
  try {
    return await apiRequest<FeedItem[]>(`/communities/${id}/posts`);
  } catch {
    return [];
  }
}

export async function postToCommunity(communityId: string, content: string): Promise<FeedItem> {
  return apiRequest<FeedItem>(`/communities/${communityId}/posts`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}
