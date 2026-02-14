import type { Conversation, ChatMessage, Attachment } from "@/lib/types";
import { apiRequest, isApiConfigured } from "./client";
import { getStoredToken } from "./auth";

export async function getConversations(): Promise<Conversation[]> {
  if (!isApiConfigured() || !getStoredToken()) return [];
  try {
    return await apiRequest<Conversation[]>("/chat/conversations");
  } catch {
    return [];
  }
}

export async function getOrCreateConversation(otherUserId: string): Promise<Conversation | null> {
  if (!isApiConfigured() || !getStoredToken()) return null;
  try {
    return await apiRequest<Conversation>("/chat/conversations", {
      method: "POST",
      body: JSON.stringify({ otherUserId }),
    });
  } catch {
    return null;
  }
}

export interface GetMessagesParams {
  limit?: number;
  before?: string;
}

export interface GetMessagesResponse {
  messages: ChatMessage[];
  hasMore: boolean;
}

export async function getMessages(
  conversationId: string,
  params?: GetMessagesParams
): Promise<GetMessagesResponse | null> {
  if (!isApiConfigured() || !getStoredToken()) return null;
  try {
    const search = new URLSearchParams();
    if (params?.limit != null) search.set("limit", String(params.limit));
    if (params?.before) search.set("before", params.before);
    const q = search.toString();
    const url = `/chat/conversations/${encodeURIComponent(conversationId)}/messages${q ? `?${q}` : ""}`;
    return await apiRequest<GetMessagesResponse>(url);
  } catch {
    return null;
  }
}

export type SendMessageType = "TEXT" | "AUDIO" | "VIDEO" | "DOCUMENT";

export interface SendMessageBody {
  conversationId: string;
  content?: string | null;
  type?: SendMessageType;
  attachments?: Attachment[];
}

export async function sendMessage(body: SendMessageBody): Promise<ChatMessage | null> {
  if (!isApiConfigured() || !getStoredToken()) return null;
  try {
    return await apiRequest<ChatMessage>("/chat/messages", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch {
    return null;
  }
}
