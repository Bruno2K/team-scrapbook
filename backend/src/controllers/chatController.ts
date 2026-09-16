import type { Request, Response } from "express";
import type { Server } from "socket.io";
import { z } from "zod";
import {
  listConversations,
  getOrCreateConversation,
  getMessages,
  createMessage,
  triggerAiReplyIfNeeded,
} from "../services/chatService.js";
import { conversationToJSON, chatMessageToJSON } from "../views/chatView.js";
import { createNotification } from "../modules/notifications/index.js";
import { getOtherParticipant, sendMessageSchema } from "../modules/messaging/index.js";

const createConversationSchema = z.object({
  otherUserId: z.string().min(1, "otherUserId é obrigatório").max(128),
}).strict();

export async function getConversations(req: Request, res: Response) {
  if (!req.actor) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  try {
    const convos = await listConversations(req.actor.id);
    const json = convos.map((c) => conversationToJSON(c, req.actor!.id));
    res.json(json);
  } catch (err) {
    res.status(500).json({ message: "Erro ao listar conversas" });
  }
}

export async function postConversation(req: Request, res: Response) {
  if (!req.actor) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const parsed = createConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
    return;
  }
  const conv = await getOrCreateConversation(req.actor.id, parsed.data.otherUserId);
  if (!conv) {
    res.status(403).json({ message: "Não é possível conversar com este usuário (apenas amigos)" });
    return;
  }
  const json = conversationToJSON(conv, req.actor.id);
  res.status(201).json(json);
}

export async function getConversationMessages(req: Request, res: Response) {
  if (!req.actor) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const { conversationId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
  const before = typeof req.query.before === "string" ? req.query.before : undefined;
  const result = await getMessages(conversationId, req.actor.id, { limit, before });
  if (!result) {
    res.status(404).json({ message: "Conversa não encontrada" });
    return;
  }
  const json = {
    messages: result.messages.map(chatMessageToJSON),
    hasMore: result.hasMore,
  };
  res.json(json);
}

export async function postMessage(req: Request, res: Response) {
  if (!req.actor) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
    return;
  }
  const { conversationId, content, type, attachments } = parsed.data;
  const message = await createMessage({
    conversationId,
    senderId: req.actor.id,
    content: content ?? null,
    type,
    attachments: attachments?.length ? attachments : undefined,
  });
  if (!message) {
    res.status(403).json({ message: "Não é possível enviar mensagem nesta conversa" });
    return;
  }
  const recipientId = await getOtherParticipant(conversationId, req.actor.id);
  if (recipientId) {
    await createNotification({
      userId: recipientId,
      type: "CHAT_MESSAGE",
      payload: { conversationId, messageId: message.id },
    });
  }
  const json = chatMessageToJSON(message);
  res.status(201).json(json);

  // If recipient is AI-managed, generate reply in background and push via Socket to human
  if (recipientId) {
    setImmediate(async () => {
      const aiMessage = await triggerAiReplyIfNeeded(
        conversationId,
        req.actor!.id,
        recipientId
      );
      if (aiMessage) {
        const io = req.app.get("io") as Server | undefined;
        if (io) io.to(`user:${req.actor!.id}`).emit("message", chatMessageToJSON(aiMessage));
      }
    });
  }
}
