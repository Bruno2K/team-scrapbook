import type { Conversation, ChatMessage as PrismaChatMessage, User } from "@prisma/client";

export interface ChatUserJSON {
  id: string;
  nickname: string;
  name: string;
  avatar: string;
  online: boolean;
  isAiManaged?: boolean;
}

export interface ChatMessageJSON {
  id: string;
  conversationId: string;
  sender: ChatUserJSON;
  content: string | null;
  type: string;
  attachments: Array<{ url: string; type: string; filename?: string }> | null;
  createdAt: string;
}

export interface LastMessagePreview {
  id: string;
  content: string | null;
  type: string;
  createdAt: string;
  sender?: { id: string; nickname: string };
}

export interface ConversationJSON {
  id: string;
  otherUser: ChatUserJSON;
  lastMessagePreview: LastMessagePreview | null;
  lastActivityAt: string;
}

type UserSelect = Pick<User, "id" | "nickname" | "name" | "avatar"> & { online?: boolean; isAiManaged?: boolean };

function userToChatJSON(u: UserSelect): ChatUserJSON {
  return {
    id: u.id,
    nickname: u.nickname,
    name: u.name,
    avatar: u.avatar ?? "",
    online: u.online ?? false,
    isAiManaged: u.isAiManaged ?? false,
  };
}

function parseAttachments(attachments: unknown): Array<{ url: string; type: string; filename?: string }> | null {
  if (!attachments) return null;
  if (!Array.isArray(attachments)) return null;
  return attachments.map((a) => {
    const x = a as Record<string, unknown>;
    return {
      url: typeof x.url === "string" ? x.url : "",
      type: typeof x.type === "string" ? x.type : "document",
      filename: typeof x.filename === "string" ? x.filename : undefined,
    };
  });
}

export function conversationToJSON(
  conv: Conversation & {
    user1: UserSelect;
    user2: UserSelect;
    messages: Array<{
      id: string;
      content: string | null;
      type: string;
      createdAt: Date;
      sender?: { id: string; nickname: string };
    }>;
  },
  currentUserId: string
): ConversationJSON {
  const otherUser = conv.user1Id === currentUserId ? conv.user2 : conv.user1;
  const lastMsg = conv.messages[0] ?? null;
  return {
    id: conv.id,
    otherUser: userToChatJSON(otherUser),
    lastMessagePreview: lastMsg
      ? {
          id: lastMsg.id,
          content: lastMsg.content,
          type: lastMsg.type,
          createdAt: lastMsg.createdAt.toISOString(),
          sender: lastMsg.sender,
        }
      : null,
    lastActivityAt: conv.updatedAt.toISOString(),
  };
}

type MessageWithSender = PrismaChatMessage & {
  sender: UserSelect;
};

export function chatMessageToJSON(msg: MessageWithSender): ChatMessageJSON {
  const raw = msg.attachments as unknown;
  return {
    id: msg.id,
    conversationId: msg.conversationId,
    sender: userToChatJSON(msg.sender),
    content: msg.content,
    type: msg.type,
    attachments: parseAttachments(raw),
    createdAt: msg.createdAt.toISOString(),
  };
}
