import { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { verifyToken } from "./services/authService.js";
import { createMessage, isParticipant, triggerAiReplyIfNeeded } from "./services/chatService.js";
import { createNotification } from "./services/notificationService.js";
import { chatMessageToJSON } from "./views/chatView.js";
import { prisma } from "./db/client.js";

const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:8080";

export function setupSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: CORS_ORIGIN.split(",").map((o) => o.trim()),
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket: Socket) => {
    const token =
      (socket.handshake.auth?.token as string) ||
      (socket.handshake.query?.token as string);
    if (!token) {
      socket.disconnect(true);
      return;
    }
    let userId: string;
    try {
      const payload = verifyToken(token);
      userId = payload.userId;
    } catch {
      socket.disconnect(true);
      return;
    }
    socket.data.userId = userId;
    socket.join(`user:${userId}`);

    prisma.user
      .update({ where: { id: userId }, data: { online: true } })
      .catch(() => {});

    socket.on("message", async (payload: unknown) => {
      const body = payload as Record<string, unknown>;
      const conversationId = typeof body?.conversationId === "string" ? body.conversationId : null;
      const content = typeof body?.content === "string" ? body.content : typeof body?.content === "undefined" ? null : null;
      const type = (body?.type === "TEXT" || body?.type === "AUDIO" || body?.type === "VIDEO" || body?.type === "DOCUMENT")
        ? body.type
        : "TEXT";
      let attachments: Array<{ url: string; type: string; filename?: string }> | undefined;
      if (Array.isArray(body?.attachments)) {
        attachments = body.attachments
          .filter((a: unknown) => a && typeof (a as Record<string, unknown>).url === "string")
          .map((a: unknown) => {
            const x = a as Record<string, unknown>;
            return {
              url: x.url as string,
              type: (typeof x.type === "string" ? x.type : "document") as string,
              filename: typeof x.filename === "string" ? x.filename : undefined,
            };
          });
        if (attachments.length === 0) attachments = undefined;
      }
      if (!conversationId) return;
      const message = await createMessage({
        conversationId,
        senderId: userId,
        content,
        type,
        attachments,
      });
      if (!message) return;
      const json = chatMessageToJSON(message);
      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { user1Id: true, user2Id: true },
      });
      if (conv) {
        const recipientId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
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
      const ok = await isParticipant(conversationId, userId);
      if (!ok) return;
      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { user1Id: true, user2Id: true },
      });
      if (conv) {
        const recipientId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
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
