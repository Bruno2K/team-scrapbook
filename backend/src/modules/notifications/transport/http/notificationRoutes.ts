import { Router } from "express";
import { authMiddleware } from "../../../../middleware/auth.js";
import type { NotificationApplication } from "../../application/notificationApplication.js";
import { createNotificationController } from "./notificationController.js";

export function createNotificationRoutes(application: NotificationApplication) {
  const router = Router();
  const controller = createNotificationController(application);

  router.get("/me/notifications", authMiddleware, controller.getMyNotifications);
  router.patch("/me/notifications/read-all", authMiddleware, controller.markAllNotificationsRead);
  router.patch("/me/notifications/:id/read", authMiddleware, controller.markNotificationRead);

  return router;
}
