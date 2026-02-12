import { MOCK_FEED } from "@/lib/mockData";
import { useMemo } from "react";

export function useFeed() {
  const feed = useMemo(() => MOCK_FEED, []);
  return { feed, isLoading: false };
}
