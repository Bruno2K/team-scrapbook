import type { ChatMessageType } from "@prisma/client";
import { prisma } from "../db/client.js";
import { canChatWith, friendPair } from "./userService.js";
import { generateReply, isGeminiConfigured } from "./geminiService.js";

/** Get or create a conversation between the current user and another. Fails if not friends. */
export async function getOrCreateConversation(meId: string, otherUserId: string) {
  const allowed = await canChatWith(meId, otherUserId);
  if (!allowed) return null;
  const [u1, u2] = friendPair(meId, otherUserId);
  const existing = await prisma.conversation.findUnique({
    where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
    include: {
      user1: { select: { id: true, nickname: true, name: true, avatar: true, online: true, isAiManaged: true } },
      user2: { select: { id: true, nickname: true, name: true, avatar: true, online: true, isAiManaged: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, content: true, type: true, createdAt: true },
      },
    },
  });
  if (existing) return existing;
  return prisma.conversation.create({
    data: { user1Id: u1, user2Id: u2 },
    include: {
      user1: { select: { id: true, nickname: true, name: true, avatar: true, online: true, isAiManaged: true } },
      user2: { select: { id: true, nickname: true, name: true, avatar: true, online: true, isAiManaged: true } },
      messages: { take: 0 },
    },
  });
}

/** List conversations for the current user with last message preview, ordered by updatedAt desc. */
export async function listConversations(userId: string) {
  const convos = await prisma.conversation.findMany({
    where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
    orderBy: { updatedAt: "desc" },
    include: {
      user1: { select: { id: true, nickname: true, name: true, avatar: true, online: true, isAiManaged: true } },
      user2: { select: { id: true, nickname: true, name: true, avatar: true, online: true, isAiManaged: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: { select: { id: true, nickname: true, name: true, avatar: true, online: true, isAiManaged: true } } },
      },
    },
  });
  return convos;
}

/** Check if userId is a participant of the conversation. */
export async function isParticipant(conversationId: string, userId: string): Promise<boolean> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { user1Id: true, user2Id: true },
  });
  if (!conv) return false;
  return conv.user1Id === userId || conv.user2Id === userId;
}

/** Get messages for a conversation with pagination. */
export async function getMessages(
  conversationId: string,
  userId: string,
  options: { limit?: number; before?: string } = {}
) {
  const ok = await isParticipant(conversationId, userId);
  if (!ok) return null;
  const { limit = 50, before } = options;
  const cursor = before ? { id: before } : undefined;
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor, skip: 1 } : {}),
    include: {
      sender: { select: { id: true, nickname: true, name: true, avatar: true, online: true, isAiManaged: true } },
    },
  });
  const hasMore = messages.length > limit;
  const list = hasMore ? messages.slice(0, limit) : messages;
  return { messages: list.reverse(), hasMore };
}

export interface CreateMessageInput {
  conversationId: string;
  senderId: string;
  content?: string | null;
  type: ChatMessageType;
  attachments?: Array<{ url: string; type: string; filename?: string }> | null;
}

/** Create a message. Returns null if user is not a participant or cannot chat with the other. */
export async function createMessage(input: CreateMessageInput) {
  const { conversationId, senderId, content, type, attachments } = input;
  const ok = await isParticipant(conversationId, senderId);
  if (!ok) return null;
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { user1Id: true, user2Id: true },
  });
  if (!conv) return null;
  const otherId = conv.user1Id === senderId ? conv.user2Id : conv.user1Id;
  const allowed = await canChatWith(senderId, otherId);
  if (!allowed) return null;

  const message = await prisma.chatMessage.create({
    data: {
      conversationId,
      senderId,
      content: content ?? null,
      type,
      attachments: attachments ?? undefined,
    },
    include: {
      sender: { select: { id: true, nickname: true, name: true, avatar: true, online: true, isAiManaged: true } },
    },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
  return message;
}

const AI_REPLY_HISTORY_LIMIT = 20;

/**
 * If recipient is an AI-managed user, generate a reply via Gemini and create a message as that user.
 * Returns the created AI message or null.
 */
export async function triggerAiReplyIfNeeded(
  conversationId: string,
  humanUserId: string,
  recipientId: string
): Promise<Awaited<ReturnType<typeof createMessage>> | null> {
  if (!isGeminiConfigured()) return null;
  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true, isAiManaged: true, mainClass: true, nickname: true },
  });
  if (!recipient?.isAiManaged) return null;

  const recent = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: AI_REPLY_HISTORY_LIMIT,
    include: { sender: { select: { id: true } } },
  });
  const history = recent.reverse().map((m) => ({
    role: m.senderId === recipientId ? ("model" as const) : ("user" as const),
    content: m.content ?? (m.attachments ? "[mídia]" : ""),
  }));
  const lastHuman = recent.find((m) => m.senderId === humanUserId);
  const lastHumanContent = lastHuman?.content ?? "";
  if (!lastHumanContent.trim() && !lastHuman?.attachments) return null;

  const reply = await generateReply(
    recipient.mainClass,
    recipient.nickname,
    history,
    lastHumanContent.trim() || "[enviou mídia]"
  );
  if (!reply) return null;

  const aiMessage = await createMessage({
    conversationId,
    senderId: recipientId,
    content: reply.content,
    type: "TEXT",
    attachments: reply.attachments,
  });
  return aiMessage;
}
