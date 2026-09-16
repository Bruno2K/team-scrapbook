import { createNotificationApplication } from "./application/notificationApplication.js";
import { prismaNotificationRepository } from "./persistence/prismaNotificationRepository.js";
import { createNotificationRoutes } from "./transport/http/notificationRoutes.js";
import type { CreateNotificationInput, NotificationDelivery } from "./contracts.js";

export type {
  CreateNotificationInput,
  NotificationDelivery,
  NotificationJSON,
  NotificationPayload,
  NotificationType,
} from "./contracts.js";

const application = createNotificationApplication(prismaNotificationRepository);

export const notificationRoutes = createNotificationRoutes(application);

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  await application.create(input);
}

export async function deleteByJoinRequestId(joinRequestId: string): Promise<void> {
  await application.deleteByJoinRequestId(joinRequestId);
}

export function setNotificationDelivery(delivery: NotificationDelivery): void {
  application.setDelivery(delivery);
}
