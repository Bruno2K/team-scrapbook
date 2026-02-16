import type { Attachment, Community, CommunityDetail, CommunityMemberRole, FeedItem } from "@/lib/types";
import { apiRequest, isApiConfigured } from "./client";
import { MOCK_COMMUNITIES, MOCK_MY_COMMUNITIES, MOCK_RECOMMENDED_COMMUNITIES } from "@/lib/mockData";

export interface GetCommunitiesParams {
  search?: string;
  memberOnly?: boolean;
}

function buildCommunitiesQuery(params?: GetCommunitiesParams): string {
  if (!params) return "";
  const q = new URLSearchParams();
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.memberOnly === true) q.set("memberOnly", "true");
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function getCommunities(params?: GetCommunitiesParams): Promise<Community[]> {
  if (!isApiConfigured()) {
    if (params?.memberOnly) return MOCK_MY_COMMUNITIES;
    const search = params?.search?.trim().toLowerCase();
    if (search) {
      return MOCK_COMMUNITIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.description.toLowerCase().includes(search)
      );
    }
    return MOCK_COMMUNITIES;
  }
  try {
    return await apiRequest<Community[]>(`/communities${buildCommunitiesQuery(params)}`);
  } catch {
    return MOCK_COMMUNITIES;
  }
}

export async function getMyCommunities(): Promise<Community[]> {
  if (!isApiConfigured()) return MOCK_MY_COMMUNITIES;
  return getCommunities({ memberOnly: true });
}

export async function getRecommendedCommunities(): Promise<Community[]> {
  if (!isApiConfigured()) return MOCK_RECOMMENDED_COMMUNITIES;
  try {
    return await apiRequest<Community[]>("/communities/recommendations");
  } catch {
    return [];
  }
}

export async function getHypeCommunities(): Promise<Community[]> {
  if (!isApiConfigured()) return MOCK_COMMUNITIES;
  try {
    return await apiRequest<Community[]>("/communities/hype");
  } catch {
    // Em caso de erro, volta para a lista padrão
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
  isPrivate?: boolean;
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
  isPrivate?: boolean;
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

export type CommunityMemberRoleValue = "MEMBER" | "MODERATOR" | "ADMIN";

export async function updateMemberRole(
  communityId: string,
  userId: string,
  role: CommunityMemberRoleValue
): Promise<void> {
  await apiRequest(`/communities/${communityId}/members/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function getCommunityPosts(id: string): Promise<FeedItem[]> {
  if (!isApiConfigured()) return [];
  try {
    return await apiRequest<FeedItem[]>(`/communities/${id}/posts`);
  } catch {
    return [];
  }
}

export interface PostToCommunityOptions {
  allowComments?: boolean;
  allowReactions?: boolean;
  attachments?: Attachment[];
}

export async function postToCommunity(
  communityId: string,
  content: string,
  options?: PostToCommunityOptions
): Promise<FeedItem> {
  return apiRequest<FeedItem>(`/communities/${communityId}/posts`, {
    method: "POST",
    body: JSON.stringify({
      content,
      allowComments: options?.allowComments,
      allowReactions: options?.allowReactions,
      attachments: options?.attachments,
    }),
  });
}

// --- Private communities: join requests and invites ---

export interface CommunityInviteItem {
  id: string;
  communityId: string;
  community: { id: string; name: string };
  inviter: { id: string; nickname: string; name: string };
  createdAt: string;
}

export async function getMyPendingInvites(): Promise<CommunityInviteItem[]> {
  if (!isApiConfigured()) return [];
  try {
    return await apiRequest<CommunityInviteItem[]>("/communities/invites/me");
  } catch {
    return [];
  }
}

export interface CommunityJoinRequestItem {
  id: string;
  userId: string;
  user: { id: string; nickname: string; name: string };
  createdAt: string;
}

export async function getCommunityJoinRequests(communityId: string): Promise<CommunityJoinRequestItem[]> {
  if (!isApiConfigured()) return [];
  try {
    return await apiRequest<CommunityJoinRequestItem[]>(`/communities/${communityId}/join-requests`);
  } catch {
    return [];
  }
}

export interface PendingJoinRequestResponse {
  pending: boolean;
  id?: string;
  status?: string;
  createdAt?: string;
}

export async function getMyPendingJoinRequest(communityId: string): Promise<PendingJoinRequestResponse> {
  if (!isApiConfigured()) return { pending: false };
  try {
    return await apiRequest<PendingJoinRequestResponse>(`/communities/${communityId}/join-request`);
  } catch {
    return { pending: false };
  }
}

export async function createJoinRequest(communityId: string): Promise<{ id: string; status: string; createdAt: string }> {
  return apiRequest(`/communities/${communityId}/join-request`, {
    method: "POST",
  });
}

export async function approveJoinRequest(communityId: string, requestId: string): Promise<void> {
  await apiRequest(`/communities/${communityId}/join-requests/${requestId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "approve" }),
  });
}

export async function rejectJoinRequest(communityId: string, requestId: string): Promise<void> {
  await apiRequest(`/communities/${communityId}/join-requests/${requestId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "reject" }),
  });
}

export async function postInvite(communityId: string, inviteeId: string): Promise<void> {
  await apiRequest(`/communities/${communityId}/invites`, {
    method: "POST",
    body: JSON.stringify({ inviteeId }),
  });
}

export async function acceptCommunityInvite(communityId: string, inviteId: string): Promise<void> {
  await apiRequest(`/communities/${communityId}/invites/${inviteId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "accept" }),
  });
}

export async function declineCommunityInvite(communityId: string, inviteId: string): Promise<void> {
  await apiRequest(`/communities/${communityId}/invites/${inviteId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "decline" }),
  });
}
