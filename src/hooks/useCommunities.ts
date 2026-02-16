import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCommunities,
  getMyCommunities,
  getRecommendedCommunities,
  getHypeCommunities,
  getCommunity,
  getCommunityMembers,
  getCommunityPosts,
  createCommunity,
  updateCommunity,
  deleteCommunity,
  joinCommunity,
  leaveCommunity,
  removeMember,
  updateMemberRole,
  postToCommunity,
  createJoinRequest,
  getMyPendingJoinRequest,
  getCommunityJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  postInvite,
  getMyPendingInvites,
  acceptCommunityInvite,
} from "@/api/communities";
import type { CreateCommunityInput, GetCommunitiesParams, UpdateCommunityInput } from "@/api/communities";

export const COMMUNITIES_QUERY_KEY = ["communities"];
export const COMMUNITY_QUERY_KEY = (id: string) => ["communities", id] as const;
export const COMMUNITY_MEMBERS_QUERY_KEY = (id: string) => ["communities", id, "members"] as const;
export const COMMUNITY_POSTS_QUERY_KEY = (id: string) => ["communities", id, "posts"] as const;

export function useCommunities(params?: GetCommunitiesParams) {
  const { data: communities = [], isLoading, error } = useQuery({
    queryKey: [...COMMUNITIES_QUERY_KEY, params ?? {}],
    queryFn: () => getCommunities(params),
  });
  return { communities, isLoading, error };
}

export function useMyCommunities() {
  const { data: communities = [], isLoading, error } = useQuery({
    queryKey: [...COMMUNITIES_QUERY_KEY, "mine"],
    queryFn: getMyCommunities,
  });
  return { communities, isLoading, error };
}

export function useRecommendedCommunities() {
  const { data: communities = [], isLoading, error } = useQuery({
    queryKey: [...COMMUNITIES_QUERY_KEY, "recommendations"],
    queryFn: getRecommendedCommunities,
  });
  return { communities, isLoading, error };
}

export function useHypeCommunities() {
  const { data: communities = [], isLoading, error } = useQuery({
    queryKey: [...COMMUNITIES_QUERY_KEY, "hype"],
    queryFn: getHypeCommunities,
  });
  return { communities, isLoading, error };
}

export function useCommunity(id: string | undefined) {
  const { data: community, isLoading, error } = useQuery({
    queryKey: COMMUNITY_QUERY_KEY(id ?? ""),
    queryFn: () => getCommunity(id!),
    enabled: !!id,
  });
  return { community: community ?? null, isLoading, error };
}

export function useCommunityMembers(communityId: string | undefined) {
  const { data: members = [], isLoading, error } = useQuery({
    queryKey: COMMUNITY_MEMBERS_QUERY_KEY(communityId ?? ""),
    queryFn: () => getCommunityMembers(communityId!),
    enabled: !!communityId,
  });
  return { members, isLoading, error };
}

export function useCommunityPosts(communityId: string | undefined) {
  const { data: posts = [], isLoading, error } = useQuery({
    queryKey: COMMUNITY_POSTS_QUERY_KEY(communityId ?? ""),
    queryFn: () => getCommunityPosts(communityId!),
    enabled: !!communityId,
  });
  return { posts, isLoading, error };
}

function useInvalidateCommunity(communityId: string | undefined) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: COMMUNITIES_QUERY_KEY });
    if (communityId) {
      qc.invalidateQueries({ queryKey: COMMUNITY_QUERY_KEY(communityId) });
      qc.invalidateQueries({ queryKey: COMMUNITY_MEMBERS_QUERY_KEY(communityId) });
      qc.invalidateQueries({ queryKey: COMMUNITY_POSTS_QUERY_KEY(communityId) });
      qc.invalidateQueries({ queryKey: [...COMMUNITY_QUERY_KEY(communityId), "join-request"] });
      qc.invalidateQueries({ queryKey: [...COMMUNITY_QUERY_KEY(communityId), "join-requests"] });
    }
  };
}

export function useCreateCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCommunityInput) => createCommunity(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMMUNITIES_QUERY_KEY });
    },
  });
}

export function useUpdateCommunity(communityId: string) {
  const invalidate = useInvalidateCommunity(communityId);
  return useMutation({
    mutationFn: (data: UpdateCommunityInput) => updateCommunity(communityId, data),
    onSuccess: invalidate,
  });
}

export function useDeleteCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCommunity,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMMUNITIES_QUERY_KEY });
    },
  });
}

export function useJoinCommunity(communityId: string) {
  const invalidate = useInvalidateCommunity(communityId);
  return useMutation({
    mutationFn: () => joinCommunity(communityId),
    onSuccess: invalidate,
  });
}

export function useLeaveCommunity(communityId: string) {
  const invalidate = useInvalidateCommunity(communityId);
  return useMutation({
    mutationFn: () => leaveCommunity(communityId),
    onSuccess: invalidate,
  });
}

export function useRemoveMember(communityId: string) {
  const invalidate = useInvalidateCommunity(communityId);
  return useMutation({
    mutationFn: (userId: string) => removeMember(communityId, userId),
    onSuccess: invalidate,
  });
}

export function useUpdateMemberRole(communityId: string) {
  const invalidate = useInvalidateCommunity(communityId);
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: import("@/api/communities").CommunityMemberRoleValue }) =>
      updateMemberRole(communityId, userId, role),
    onSuccess: invalidate,
  });
}

export interface PostToCommunityPayload {
  content: string;
  allowComments?: boolean;
  allowReactions?: boolean;
  attachments?: import("@/lib/types").Attachment[];
}

export function usePostToCommunity(communityId: string) {
  const invalidate = useInvalidateCommunity(communityId);
  return useMutation({
    mutationFn: (payload: string | PostToCommunityPayload) => {
      if (typeof payload === "string") {
        return postToCommunity(communityId, payload);
      }
      return postToCommunity(communityId, payload.content, {
        allowComments: payload.allowComments,
        allowReactions: payload.allowReactions,
        attachments: payload.attachments,
      });
    },
    onSuccess: invalidate,
  });
}

export function useMyPendingJoinRequest(communityId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: [...COMMUNITY_QUERY_KEY(communityId ?? ""), "join-request"],
    queryFn: () => getMyPendingJoinRequest(communityId!),
    enabled: !!communityId,
  });
  return { pendingRequest: data, isLoading };
}

export function useCommunityJoinRequests(communityId: string | undefined) {
  const { data: requests = [], isLoading } = useQuery({
    queryKey: [...COMMUNITY_QUERY_KEY(communityId ?? ""), "join-requests"],
    queryFn: () => getCommunityJoinRequests(communityId!),
    enabled: !!communityId,
  });
  return { joinRequests: requests, isLoading };
}

export function useCreateJoinRequest(communityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => createJoinRequest(communityId),
    onSuccess: () => {
      const key = [...COMMUNITY_QUERY_KEY(communityId), "join-request"] as const;
      qc.setQueryData(key, { pending: true });
    },
  });
}

export function useApproveJoinRequest(communityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => approveJoinRequest(communityId, requestId),
    onSuccess: (_, requestId) => {
      const listKey = [...COMMUNITY_QUERY_KEY(communityId), "join-requests"] as const;
      qc.setQueryData(listKey, (old: unknown[] | undefined) =>
        Array.isArray(old) ? old.filter((r: { id: string }) => r.id !== requestId) : old
      );
      void qc.refetchQueries({ queryKey: COMMUNITY_MEMBERS_QUERY_KEY(communityId) });
    },
  });
}

export function useRejectJoinRequest(communityId: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateCommunity(communityId);
  return useMutation({
    mutationFn: (requestId: string) => rejectJoinRequest(communityId, requestId),
    onSuccess: async () => {
      invalidate();
      await qc.refetchQueries({ queryKey: [...COMMUNITY_QUERY_KEY(communityId), "join-requests"] });
    },
  });
}

export function usePostInvite(communityId: string) {
  const invalidate = useInvalidateCommunity(communityId);
  return useMutation({
    mutationFn: (inviteeId: string) => postInvite(communityId, inviteeId),
    onSuccess: invalidate,
  });
}

export const MY_PENDING_INVITES_QUERY_KEY = ["communities", "invites", "me"] as const;

export function useMyPendingInvites() {
  const { data: invites = [], isLoading } = useQuery({
    queryKey: MY_PENDING_INVITES_QUERY_KEY,
    queryFn: getMyPendingInvites,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  return { pendingInvites: invites, isLoading };
}

export function useAcceptCommunityInvite(communityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => acceptCommunityInvite(communityId, inviteId),
    onMutate: () => {
      const commKey = COMMUNITY_QUERY_KEY(communityId);
      const prevCommunity = qc.getQueryData(commKey);
      const prevInvites = qc.getQueryData(MY_PENDING_INVITES_QUERY_KEY);
      qc.setQueryData(MY_PENDING_INVITES_QUERY_KEY, (old: { communityId: string }[] | undefined) =>
        Array.isArray(old) ? old.filter((inv) => inv.communityId !== communityId) : old
      );
      qc.setQueryData(commKey, (old: { isMember?: boolean; members?: number } | undefined) =>
        old ? { ...old, isMember: true, members: ((old.members as number) ?? 0) + 1 } : old
      );
      return { prevCommunity, prevInvites };
    },
    onError: (_err, _inviteId, context) => {
      if (context?.prevCommunity != null) {
        qc.setQueryData(COMMUNITY_QUERY_KEY(communityId), context.prevCommunity);
      }
      if (context?.prevInvites != null) {
        qc.setQueryData(MY_PENDING_INVITES_QUERY_KEY, context.prevInvites);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: COMMUNITY_QUERY_KEY(communityId) });
    },
  });
}
