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
  postToCommunity,
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

export interface PostToCommunityPayload {
  content: string;
  allowComments?: boolean;
  allowReactions?: boolean;
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
      });
    },
    onSuccess: invalidate,
  });
}
