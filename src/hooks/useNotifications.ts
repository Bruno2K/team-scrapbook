import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMyNotifications,
  markNotificationRead as apiMarkRead,
  markAllNotificationsRead as apiMarkAllRead,
} from "@/api/notifications";
export const NOTIFICATIONS_QUERY_KEY = ["users", "me", "notifications"] as const;

export function useNotifications(
  params?: { unreadOnly?: boolean; limit?: number; cursor?: string },
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled ?? true;
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, params?.unreadOnly ?? false, params?.limit ?? 30, params?.cursor ?? ""],
    queryFn: () => getMyNotifications(params),
    staleTime: 30_000,
    enabled,
  });
  return {
    notifications: data?.items ?? [],
    nextCursor: data?.nextCursor,
    isLoading,
    error,
    refetch,
  };
}

export function useUnreadCount(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const { data, isLoading } = useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, true, 100, ""],
    queryFn: () => getMyNotifications({ unreadOnly: true, limit: 100 }),
    staleTime: 30_000,
    enabled,
  });
  return { unreadCount: data?.items?.length ?? 0, isLoading };
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => apiMarkRead(notificationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: apiMarkAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}