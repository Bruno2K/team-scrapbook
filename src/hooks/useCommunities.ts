import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCommunities,
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
import type { CreateCommunityInput, UpdateCommunityInput } from "@/api/communities";

export const COMMUNITIES_QUERY_KEY = ["communities"];
export const COMMUNITY_QUERY_KEY = (id: string) => ["communities", id] as const;
export const COMMUNITY_MEMBERS_QUERY_KEY = (id: string) => ["communities", id, "members"] as const;
export const COMMUNITY_POSTS_QUERY_KEY = (id: string) => ["communities", id, "posts"] as const;

export function useCommunities() {
  const { data: communities = [], isLoading, error } = useQuery({
    queryKey: COMMUNITIES_QUERY_KEY,
    queryFn: getCommunities,
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

export function usePostToCommunity(communityId: string) {
  const invalidate = useInvalidateCommunity(communityId);
  return useMutation({
    mutationFn: (content: string) => postToCommunity(communityId, content),
    onSuccess: invalidate,
  });
}
