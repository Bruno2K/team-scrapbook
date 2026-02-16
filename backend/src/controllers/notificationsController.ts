import type { Request, Response } from "express";
import {
  listNotificationsForUser,
  markNotificationRead as markNotificationReadService,
  markAllNotificationsRead as markAllNotificationsReadService,
} from "../services/notificationService.js";
import { notificationToJSON } from "../views/notificationView.js";

export async function getMyNotifications(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const unreadOnly = req.query.unreadOnly === "true";
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
  try {
    const { items, nextCursor } = await listNotificationsForUser({
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
}

export async function markNotificationRead(req: Request, res: Response) {
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
    const result = await markNotificationReadService(req.user.id, notificationId);
    if (result.count === 0) {
      res.status(404).json({ message: "Notificação não encontrada" });
      return;
    }
    res.status(200).json({ message: "Marcada como lida" });
  } catch {
    res.status(500).json({ message: "Erro ao atualizar notificação" });
  }
}

export async function markAllNotificationsRead(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  try {
    await markAllNotificationsReadService(req.user.id);
    res.status(200).json({ message: "Todas marcadas como lidas" });
  } catch {
    res.status(500).json({ message: "Erro ao atualizar notificações" });
  }
}
