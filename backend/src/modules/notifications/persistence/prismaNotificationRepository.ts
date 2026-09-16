import type { Prisma } from "@prisma/client";
import { prisma } from "../../../db/client.js";
import type {
  ListNotificationsOptions,
  NotificationRecord,
  NotificationRepository,
} from "../application/notificationApplication.js";
import type { CreateNotificationInput, NotificationType } from "../contracts.js";

export const prismaNotificationRepository: NotificationRepository = {
  create(input: CreateNotificationInput): Promise<NotificationRecord> {
    return prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue,
      },
    });
  },

  listForUser(options: ListNotificationsOptions): Promise<NotificationRecord[]> {
    const { userId, unreadOnly = false, limit = 30, cursor } = options;
    return prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  },

  markRead(userId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
  },

  markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  },

  listByType(type: NotificationType): Promise<NotificationRecord[]> {
    return prisma.notification.findMany({ where: { type } });
  },

  async deleteByIds(ids: string[]): Promise<void> {
    await prisma.notification.deleteMany({ where: { id: { in: ids } } });
  },
};
