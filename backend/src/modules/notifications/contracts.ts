export type NotificationType =
  | "SCRAP"
  | "FRIEND_REQUEST"
  | "COMMUNITY_INVITE"
  | "CHAT_MESSAGE"
  | "COMMUNITY_JOIN_REQUEST";

export type NotificationPayload =
  | { scrapId: string }
  | { requestId: string }
  | { inviteId: string; communityId: string }
  | { conversationId: string; messageId: string }
  | { joinRequestId: string; communityId: string; userId: string };

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  payload: NotificationPayload;
  dedupeKey?: string;
}

export interface NotificationJSON {
  id: string;
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export type NotificationDelivery = (notification: NotificationJSON) => void;
