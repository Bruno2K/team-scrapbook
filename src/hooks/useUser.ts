import { useQuery } from "@tanstack/react-query";
import { CURRENT_USER } from "@/lib/mockData";
import { getMe } from "@/api/user";
import { isApiConfigured } from "@/api/client";
import { useAccessToken, useAuthStatus } from "@/auth/useAuthSession";
import type { User } from "@/lib/types";

const ME_QUERY_KEY = ["users", "me"] as const;

export function useUser() {
  const configured = isApiConfigured();
  const status = useAuthStatus();
  const accessToken = useAccessToken();
  const enabled = configured && status === "authenticated" && Boolean(accessToken);

  const query = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async (): Promise<User> => {
      const u = await getMe();
      if (!u) throw new Error("Not authenticated");
      return u;
    },
    enabled,
    staleTime: 60 * 1000,
    retry: false,
  });

  if (!configured) {
    return {
      user: CURRENT_USER as User,
      isLoading: false,
      error: null as Error | null,
      refetch: query.refetch,
    };
  }

  if (status === "bootstrapping" || (enabled && query.isLoading)) {
    return {
      user: null,
      isLoading: true,
      error: null as Error | null,
      refetch: query.refetch,
    };
  }

  if (!enabled) {
    return {
      user: null,
      isLoading: false,
      error: null as Error | null,
      refetch: query.refetch,
    };
  }

  if (query.isError || !query.data) {
    return {
      user: null,
      isLoading: false,
      error: query.error instanceof Error ? query.error : new Error("Not authenticated"),
      refetch: query.refetch,
    };
  }

  return {
    user: query.data,
    isLoading: false,
    error: null as Error | null,
    refetch: query.refetch,
  };
}

export function useMeQueryKey(): readonly ["users", "me"] {
  return ME_QUERY_KEY;
}
