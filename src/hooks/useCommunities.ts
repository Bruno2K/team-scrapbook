import { useQuery } from "@tanstack/react-query";
import { getCommunities } from "@/api/communities";

export const COMMUNITIES_QUERY_KEY = ["communities"];

export function useCommunities() {
  const { data: communities = [], isLoading, error } = useQuery({
    queryKey: COMMUNITIES_QUERY_KEY,
    queryFn: getCommunities,
  });

  return { communities, isLoading, error };
}
