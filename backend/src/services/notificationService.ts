import { prisma } from "../db/client.js";
import type { NotificationType } from "@prisma/client";
import { emitNotificationIfSet } from "../notificationEmitter.js";

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
}

export async function createNotification(input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      payload: input.payload as object,
    },
  });
  emitNotificationIfSet(notification);
  return notification;
}

export interface ListNotificationsOptions {
  userId: string;
  unreadOnly?: boolean;
  limit?: number;
  cursor?: string;
}

export async function listNotificationsForUser(options: ListNotificationsOptions) {
  const { userId, unreadOnly = false, limit = 30, cursor } = options;
  const where = { userId, ...(unreadOnly ? { readAt: null } : {}) };
  const items = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const nextCursor = items.length > limit ? items.pop()?.id ?? null : null;
  return { items, nextCursor };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

/** Delete notifications with type COMMUNITY_JOIN_REQUEST and payload containing this joinRequestId (for all admins). */
export async function deleteByJoinRequestId(joinRequestId: string) {
  const notifications = await prisma.notification.findMany({
    where: { type: "COMMUNITY_JOIN_REQUEST" },
  });
  const ids = notifications.filter((n) => {
    const p = n.payload as { joinRequestId?: string };
    return p?.joinRequestId === joinRequestId;
  }).map((n) => n.id);
  if (ids.length === 0) return;
  await prisma.notification.deleteMany({ where: { id: { in: ids } } });
}
