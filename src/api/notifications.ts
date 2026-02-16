import { apiRequest } from "./client";

export type NotificationType =
  | "SCRAP"
  | "FRIEND_REQUEST"
  | "COMMUNITY_INVITE"
  | "CHAT_MESSAGE"
  | "COMMUNITY_JOIN_REQUEST";

export interface NotificationPayload {
  scrapId?: string;
  requestId?: string;
  inviteId?: string;
  communityId?: string;
  conversationId?: string;
  messageId?: string;
  joinRequestId?: string;
  userId?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  payload: NotificationPayload;
  readAt: string | null;
  createdAt: string;
}

export interface GetMyNotificationsResponse {
  items: Notification[];
  nextCursor?: string;
}

export async function getMyNotifications(params?: {
  unreadOnly?: boolean;
  limit?: number;
  cursor?: string;
}): Promise<GetMyNotificationsResponse> {
  const search = new URLSearchParams();
  if (params?.unreadOnly) search.set("unreadOnly", "true");
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.cursor) search.set("cursor", params.cursor);
  const q = search.toString();
  return apiRequest<GetMyNotificationsResponse>(`/users/me/notifications${q ? `?${q}` : ""}`);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await apiRequest(`/users/me/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiRequest("/users/me/notifications/read-all", {
    method: "PATCH",
  });
}
