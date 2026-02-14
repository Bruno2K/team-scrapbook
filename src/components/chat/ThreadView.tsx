import { useRef, useEffect } from "react";
import { useChatMessages } from "@/hooks/useChat";
import { useChat } from "@/contexts/ChatContext";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { ChatInput } from "./ChatInput";
import { getCurrentUserId } from "@/api/auth";
import { cn } from "@/lib/utils";

export interface ThreadViewProps {
  conversationId: string;
  otherUserName?: string;
}

export function ThreadView({ conversationId }: ThreadViewProps) {
  const { data, isLoading } = useChatMessages(conversationId);
  const { emitTyping, typingConversationId, typingUserId } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentUserId = getCurrentUserId();
  const isOtherTyping =
    typingConversationId === conversationId &&
    typingUserId &&
    typingUserId !== currentUserId;

  const messages = data?.messages ?? [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        ref={scrollRef}
        className={cn("list-scroll p-2")}
      >
        <div className="flex flex-col gap-3 py-2">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && messages.length === 0 && !isOtherTyping && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma mensagem ainda. Envie a primeira!
            </p>
          )}
          {isOtherTyping && (
            <p className="text-xs text-muted-foreground italic py-1">digitando...</p>
          )}
          {messages.map((msg) => (
            <ChatMessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.sender.id === currentUserId}
            />
          ))}
        </div>
      </div>
      <ChatInput
        conversationId={conversationId}
        onTyping={() => emitTyping(conversationId)}
      />
    </div>
  );
}
