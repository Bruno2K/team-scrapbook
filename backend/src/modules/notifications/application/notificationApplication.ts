import type {
  CreateNotificationInput,
  NotificationDelivery,
  NotificationJSON,
  NotificationType,
} from "../contracts.js";

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  payload: unknown;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationRepository {
  create(input: CreateNotificationInput): Promise<NotificationRecord>;
  listForUser(options: ListNotificationsOptions): Promise<NotificationRecord[]>;
  markRead(userId: string, notificationId: string): Promise<{ count: number }>;
  markAllRead(userId: string): Promise<{ count: number }>;
  listByType(type: NotificationType): Promise<NotificationRecord[]>;
  deleteByIds(ids: string[]): Promise<void>;
}

export interface ListNotificationsOptions {
  userId: string;
  unreadOnly?: boolean;
  limit?: number;
  cursor?: string;
}

export interface NotificationApplication {
  create(input: CreateNotificationInput): Promise<NotificationRecord>;
  listForUser(options: ListNotificationsOptions): Promise<{
    items: NotificationRecord[];
    nextCursor: string | null;
  }>;
  markRead(userId: string, notificationId: string): Promise<{ count: number }>;
  markAllRead(userId: string): Promise<{ count: number }>;
  deleteByJoinRequestId(joinRequestId: string): Promise<void>;
  setDelivery(delivery: NotificationDelivery): void;
}

export function notificationToJSON(notification: NotificationRecord): NotificationJSON {
  const payload = typeof notification.payload === "object" && notification.payload !== null
    ? (notification.payload as Record<string, unknown>)
    : {};

  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    payload,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export function createNotificationApplication(
  repository: NotificationRepository
): NotificationApplication {
  let delivery: NotificationDelivery | null = null;

  return {
    async create(input) {
      const notification = await repository.create(input);
      if (delivery) {
        try {
          delivery(notificationToJSON(notification));
        } catch {
          // Realtime delivery is best-effort and must not roll back persisted notifications.
        }
      }
      return notification;
    },

    async listForUser(options) {
      const limit = options.limit ?? 30;
      const items = await repository.listForUser({ ...options, limit });
      const nextCursor = items.length > limit ? items.pop()?.id ?? null : null;
      return { items, nextCursor };
    },

    markRead(userId, notificationId) {
      return repository.markRead(userId, notificationId);
    },

    markAllRead(userId) {
      return repository.markAllRead(userId);
    },

    async deleteByJoinRequestId(joinRequestId) {
      const notifications = await repository.listByType("COMMUNITY_JOIN_REQUEST");
      const ids = notifications
        .filter((notification) => {
          const payload = notification.payload as { joinRequestId?: string } | null;
          return payload?.joinRequestId === joinRequestId;
        })
        .map((notification) => notification.id);
      if (ids.length > 0) await repository.deleteByIds(ids);
    },

    setDelivery(nextDelivery) {
      delivery = nextDelivery;
    },
  };
}
