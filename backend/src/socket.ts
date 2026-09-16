import { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { createMessage, triggerAiReplyIfNeeded } from "./services/chatService.js";
import { createNotification } from "./modules/notifications/index.js";
import { chatMessageToJSON } from "./views/chatView.js";
import { prisma } from "./db/client.js";
import { resolveAccessToken, type AuthenticatedActor } from "./modules/identity/index.js";
import { canSendOrSignal, getOtherParticipant, sendMessageSchema } from "./modules/messaging/index.js";
import { messageLimiter } from "./middleware/abuseControls.js";

const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:8080";

export async function authenticateSocketToken(token: unknown): Promise<AuthenticatedActor | null> {
  if (typeof token !== "string" || !token.trim()) return null;
  try {
    const actor = await resolveAccessToken(token);
    return actor && !actor.isAiManaged ? actor : null;
  } catch {
    return null;
  }
}

export function setupSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: CORS_ORIGIN.split(",").map((o) => o.trim()),
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", async (socket: Socket) => {
    const actor = await authenticateSocketToken(socket.handshake.auth?.token);
    if (!actor) {
      socket.disconnect(true);
      return;
    }
    const userId = actor.id;
    socket.data.userId = userId;
    socket.join(`user:${userId}`);

    prisma.user
      .update({ where: { id: userId }, data: { online: true } })
      .catch(() => {});

    socket.on("message", async (payload: unknown) => {
      const rateLimit = messageLimiter.consume(userId);
      if (!rateLimit.allowed) {
        socket.emit("security:error", { code: "RATE_LIMITED", retryAfter: rateLimit.retryAfterSeconds });
        return;
      }
      const parsed = sendMessageSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("security:error", { code: "INVALID_MESSAGE" });
        return;
      }
      const { conversationId, content, type, attachments } = parsed.data;
      const message = await createMessage({
        conversationId,
        senderId: userId,
        content,
        type,
        attachments: attachments.length ? attachments : undefined,
      });
      if (!message) {
        socket.emit("security:error", { code: "FORBIDDEN" });
        return;
      }
      const json = chatMessageToJSON(message);
      const recipientId = await getOtherParticipant(conversationId, userId);
      if (recipientId) {
        await createNotification({
          userId: recipientId,
          type: "CHAT_MESSAGE",
          payload: { conversationId, messageId: message.id },
        });
        io.to(`user:${recipientId}`).emit("message", json);
        socket.emit("message", json);
        // If recipient is AI-managed, generate reply and emit to human
        const aiMessage = await triggerAiReplyIfNeeded(conversationId, userId, recipientId);
        if (aiMessage) {
          const aiJson = chatMessageToJSON(aiMessage);
          io.to(`user:${userId}`).emit("message", aiJson);
        }
      }
    });

    socket.on("typing", async (payload: unknown) => {
      const body = payload as Record<string, unknown>;
      const conversationId = typeof body?.conversationId === "string" ? body.conversationId : null;
      if (!conversationId) return;
      const ok = await canSendOrSignal(conversationId, userId);
      if (!ok) return;
      const recipientId = await getOtherParticipant(conversationId, userId);
      if (recipientId) {
        io.to(`user:${recipientId}`).emit("typing", { conversationId, userId });
      }
    });

    socket.on("disconnect", () => {
      prisma.user
        .update({ where: { id: userId }, data: { online: false } })
        .catch(() => {});
    });
  });

  return io;
}
