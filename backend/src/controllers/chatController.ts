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
import { prisma } from "../db/client.js";

const createConversationSchema = z.object({
  otherUserId: z.string().min(1, "otherUserId é obrigatório"),
});

const sendMessageSchema = z.object({
  conversationId: z.string().min(1, "conversationId é obrigatório"),
  content: z.string().nullable().optional(),
  type: z.enum(["TEXT", "AUDIO", "VIDEO", "DOCUMENT"]).default("TEXT"),
  attachments: z
    .array(
      z.object({
        url: z.string().url(),
        type: z.string(),
        filename: z.string().optional(),
      })
    )
    .optional()
    .default([]),
});

export async function getConversations(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  try {
    const convos = await listConversations(req.user.id);
    const json = convos.map((c) => conversationToJSON(c, req.user!.id));
    res.json(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao listar conversas";
    res.status(500).json({ message });
  }
}

export async function postConversation(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const parsed = createConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
    return;
  }
  const conv = await getOrCreateConversation(req.user.id, parsed.data.otherUserId);
  if (!conv) {
    res.status(403).json({ message: "Não é possível conversar com este usuário (apenas amigos)" });
    return;
  }
  const json = conversationToJSON(conv, req.user.id);
  res.status(201).json(json);
}

export async function getConversationMessages(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const { conversationId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
  const before = typeof req.query.before === "string" ? req.query.before : undefined;
  const result = await getMessages(conversationId, req.user.id, { limit, before });
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
  if (!req.user) {
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
    senderId: req.user.id,
    content: content ?? null,
    type,
    attachments: attachments?.length ? attachments : undefined,
  });
  if (!message) {
    res.status(403).json({ message: "Não é possível enviar mensagem nesta conversa" });
    return;
  }
  const json = chatMessageToJSON(message);
  res.status(201).json(json);

  // If recipient is AI-managed, generate reply in background and push via Socket to human
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { user1Id: true, user2Id: true },
  });
  const recipientId = conv
    ? conv.user1Id === req.user!.id
      ? conv.user2Id
      : conv.user1Id
    : null;
  if (recipientId) {
    setImmediate(async () => {
      const aiMessage = await triggerAiReplyIfNeeded(
        conversationId,
        req.user!.id,
        recipientId
      );
      if (aiMessage) {
        const io = req.app.get("io") as Server | undefined;
        if (io) io.to(`user:${req.user!.id}`).emit("message", chatMessageToJSON(aiMessage));
      }
    });
  }
}
