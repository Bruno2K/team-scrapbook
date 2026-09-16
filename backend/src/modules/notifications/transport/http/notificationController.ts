import type { Request, Response } from "express";
import type { NotificationApplication } from "../../application/notificationApplication.js";
import { notificationToJSON } from "../../application/notificationApplication.js";

export function createNotificationController(application: NotificationApplication) {
  return {
    async getMyNotifications(req: Request, res: Response) {
      if (!req.user) {
        res.status(401).json({ message: "Não autorizado" });
        return;
      }
      const unreadOnly = req.query.unreadOnly === "true";
      const limit = Math.min(Number(req.query.limit) || 30, 100);
      const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
      try {
        const { items, nextCursor } = await application.listForUser({
          userId: req.user.id,
          unreadOnly,
          limit,
          cursor,
        });
        res.status(200).json({
          items: items.map(notificationToJSON),
          nextCursor: nextCursor ?? undefined,
        });
      } catch {
        res.status(500).json({ message: "Erro ao carregar notificações" });
      }
    },

    async markNotificationRead(req: Request, res: Response) {
      if (!req.user) {
        res.status(401).json({ message: "Não autorizado" });
        return;
      }
      const notificationId = req.params.id;
      if (!notificationId) {
        res.status(400).json({ message: "ID da notificação é obrigatório" });
        return;
      }
      try {
        const result = await application.markRead(req.user.id, notificationId);
        if (result.count === 0) {
          res.status(404).json({ message: "Notificação não encontrada" });
          return;
        }
        res.status(200).json({ message: "Marcada como lida" });
      } catch {
        res.status(500).json({ message: "Erro ao atualizar notificação" });
      }
    },

    async markAllNotificationsRead(req: Request, res: Response) {
      if (!req.user) {
        res.status(401).json({ message: "Não autorizado" });
        return;
      }
      try {
        await application.markAllRead(req.user.id);
        res.status(200).json({ message: "Todas marcadas como lidas" });
      } catch {
        res.status(500).json({ message: "Erro ao atualizar notificações" });
      }
    },
  };
}
