import { useQuery } from "@tanstack/react-query";
import { CURRENT_USER } from "@/lib/mockData";
import { getMe } from "@/api/user";
import { getStoredToken } from "@/api/auth";
import { isApiConfigured } from "@/api/client";
import type { User } from "@/lib/types";

const ME_QUERY_KEY = ["users", "me"] as const;

export function useUser() {
  const hasApi = isApiConfigured() && Boolean(getStoredToken());
  const query = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async (): Promise<User> => {
      const u = await getMe();
      if (!u) throw new Error("Not authenticated");
      return u;
    },
    enabled: hasApi,
    staleTime: 60 * 1000,
  });

  if (hasApi && query.data) {
    return { user: query.data, isLoading: query.isLoading, refetch: query.refetch };
  }
  return {
    user: CURRENT_USER as User,
    isLoading: false,
    refetch: () => Promise.resolve(),
  };
}

export function useMeQueryKey(): readonly ["users", "me"] {
  return ME_QUERY_KEY;
}
