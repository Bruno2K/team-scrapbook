import { MOCK_COMMUNITIES } from "@/lib/mockData";
import { useMemo } from "react";

export function useCommunities() {
  const communities = useMemo(() => MOCK_COMMUNITIES, []);
  return { communities, isLoading: false };
}
