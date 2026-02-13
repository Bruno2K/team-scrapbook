import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getScraps, postScrap, type PostScrapInput } from "@/api/scraps";
import type { ScrapFilter } from "@/lib/types";

export const SCRAPS_QUERY_KEY = ["scraps"];

export function useScraps(filter: ScrapFilter = "received") {
  const { data: scraps = [], isLoading, error } = useQuery({
    queryKey: [...SCRAPS_QUERY_KEY, filter],
    queryFn: () => getScraps(filter),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  return { scraps, isLoading, error };
}

export function usePostScrap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PostScrapInput) => postScrap(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCRAPS_QUERY_KEY });
    },
  });
}
