import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getFriends,
  getBlocked,
  getAvailableToAdd,
  getRecommendations,
  addFriend as apiAddFriend,
  removeFriend as apiRemoveFriend,
  blockUser as apiBlockUser,
  unblockUser as apiUnblockUser,
} from "@/api/friends";

export const FRIENDS_QUERY_KEY = ["friends"];
export const BLOCKED_QUERY_KEY = ["blocked"];
export const AVAILABLE_QUERY_KEY = ["available"];
export const RECOMMENDATIONS_QUERY_KEY = ["recommendations"];

export function useFriends() {
  const { data: friends = [], isLoading, error } = useQuery({
    queryKey: FRIENDS_QUERY_KEY,
    queryFn: getFriends,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const onlineFriends = friends.filter((f) => f.online);
  const offlineFriends = friends.filter((f) => !f.online);

  return { friends, onlineFriends, offlineFriends, isLoading, error };
}

export function useBlocked() {
  const { data: blocked = [], isLoading, error } = useQuery({
    queryKey: BLOCKED_QUERY_KEY,
    queryFn: getBlocked,
    staleTime: 0,
  });
  return { blocked, isLoading, error };
}

export function useAvailableToAdd(search?: string) {
  const { data: available = [], isLoading, error } = useQuery({
    queryKey: [...AVAILABLE_QUERY_KEY, search ?? ""],
    queryFn: () => getAvailableToAdd(search),
    staleTime: 0,
  });
  return { available, isLoading, error };
}

export function useRecommendations() {
  const { data: recommendations = [], isLoading, error } = useQuery({
    queryKey: RECOMMENDATIONS_QUERY_KEY,
    queryFn: getRecommendations,
    staleTime: 0,
  });
  return { recommendations, isLoading, error };
}

function useInvalidateFriends() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY });
    qc.invalidateQueries({ queryKey: BLOCKED_QUERY_KEY });
    qc.invalidateQueries({ queryKey: AVAILABLE_QUERY_KEY });
    qc.invalidateQueries({ queryKey: RECOMMENDATIONS_QUERY_KEY });
  };
}

export function useAddFriend() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: apiAddFriend,
    onSuccess: invalidate,
  });
}

export function useRemoveFriend() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: apiRemoveFriend,
    onSuccess: invalidate,
  });
}

export function useBlockUser() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: apiBlockUser,
    onSuccess: invalidate,
  });
}

export function useUnblockUser() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: apiUnblockUser,
    onSuccess: invalidate,
  });
}
