import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getConversations,
  getMessages,
  getOrCreateConversation,
  sendMessage as sendMessageApi,
  type GetMessagesParams,
} from "@/api/chat";
import type { SendMessageBody } from "@/api/chat";
import { useChat } from "@/contexts/ChatContext";

export const CHAT_CONVERSATIONS_QUERY_KEY = ["chat", "conversations"] as const;

export function useChatConversations() {
  return useQuery({
    queryKey: CHAT_CONVERSATIONS_QUERY_KEY,
    queryFn: getConversations,
    staleTime: 30_000,
  });
}

export function useChatMessages(conversationId: string | null, params?: GetMessagesParams) {
  return useQuery({
    queryKey: ["chat", "messages", conversationId ?? "", params?.before ?? ""],
    queryFn: () => (conversationId ? getMessages(conversationId, params) : Promise.resolve(null)),
    enabled: Boolean(conversationId),
    staleTime: 10_000,
  });
}

export function useGetOrCreateConversation() {
  const queryClient = useQueryClient();
  return async (otherUserId: string) => {
    const conv = await getOrCreateConversation(otherUserId);
    if (conv) {
      queryClient.invalidateQueries({ queryKey: CHAT_CONVERSATIONS_QUERY_KEY });
    }
    return conv;
  };
}

/** Send message via Socket when connected, otherwise via REST. */
export function useSendChatMessage() {
  const queryClient = useQueryClient();
  const { sendMessageViaSocket, socketConnected } = useChat();
  return async (body: SendMessageBody) => {
    if (!body.conversationId) return;
    if (socketConnected) {
      sendMessageViaSocket(body.conversationId, {
        content: body.content ?? null,
        type: body.type ?? "TEXT",
        attachments: body.attachments,
      });
    } else {
      const msg = await sendMessageApi(body);
      if (msg) {
        queryClient.invalidateQueries({ queryKey: CHAT_CONVERSATIONS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: ["chat", "messages", body.conversationId] });
      }
    }
  };
}
