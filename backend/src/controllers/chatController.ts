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
import {
  getOtherParticipant,
  MessageIdempotencyConflictError,
  sendMessageSchema,
} from "../modules/messaging/index.js";

function readIdempotencyKey(req: Request): string | null | "invalid" {
  const value = req.get("Idempotency-Key");
  if (value === undefined) return null;
  return /^[\x21-\x7e]{1,128}$/.test(value) ? value : "invalid";
}

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
  const idempotencyKey = readIdempotencyKey(req);
  if (idempotencyKey === "invalid") {
    res.status(400).json({ message: "Idempotency-Key inválida" });
    return;
  }
  const recipientId = await getOtherParticipant(conversationId, req.actor.id);
  try {
    const outcome = await createMessage({
      conversationId,
      senderId: req.actor.id,
      content: content ?? null,
      type,
      attachments: attachments?.length ? attachments : undefined,
      idempotencyKey: idempotencyKey ?? undefined,
    });
    if (!outcome) {
      res.status(403).json({ message: "Não é possível enviar mensagem nesta conversa" });
      return;
    }
    const json = chatMessageToJSON(outcome.message);
    res.status(outcome.disposition === "replayed" ? 200 : 201).json(json);

    // Provider work and Socket delivery are post-commit, best effort, and only run for a new message.
    if (recipientId && outcome.disposition === "created") {
      setImmediate(async () => {
        try {
          const aiMessage = await triggerAiReplyIfNeeded(
            conversationId,
            req.actor!.id,
            recipientId
          );
          if (aiMessage) {
            const io = req.app.get("io") as Server | undefined;
            if (io) io.to(`user:${req.actor!.id}`).emit("message", chatMessageToJSON(aiMessage));
          }
        } catch {
          // The human message is committed; Gemini/realtime failure is best effort.
        }
      });
    }
  } catch (error) {
    if (error instanceof MessageIdempotencyConflictError) {
      res.status(409).json({ message: "Idempotency-Key já usada com outra mensagem" });
      return;
    }
    res.status(500).json({ message: "Erro ao enviar mensagem" });
  }
}
