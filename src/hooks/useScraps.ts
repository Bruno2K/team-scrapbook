import { useQuery } from "@tanstack/react-query";
import { getScraps } from "@/api/scraps";

export const SCRAPS_QUERY_KEY = ["scraps"];

export function useScraps() {
  const { data: scraps = [], isLoading, error } = useQuery({
    queryKey: SCRAPS_QUERY_KEY,
    queryFn: getScraps,
  });

  return { scraps, isLoading, error };
}
