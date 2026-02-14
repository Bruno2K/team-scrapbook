import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/contexts/ChatContext";
import { useChatConversations } from "@/hooks/useChat";
import { ConversationList } from "./ConversationList";
import { ThreadView } from "./ThreadView";
import type { Conversation } from "@/lib/types";
import { ChevronDown, Maximize2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 480;

export function ChatPanel() {
  const {
    isPanelOpen,
    setPanelOpen,
    activeConversationId,
    setActiveConversationId,
    setMaximized,
  } = useChat();
  const { data: conversations } = useChatConversations();
  const activeConversation = conversations?.find((c) => c.id === activeConversationId);

  if (!isPanelOpen) return null;

  return (
    <div
      className="fixed bottom-20 right-4 z-40 flex flex-col rounded-lg border-2 border-border bg-card shadow-xl tf-shadow-sm overflow-hidden"
      style={{ width: PANEL_WIDTH, height: PANEL_HEIGHT }}
    >
      <header className="flex-shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2 min-w-0">
          {activeConversation ? (
            <>
              <span className="font-heading text-sm truncate flex items-center gap-1.5">
                {activeConversation.otherUser.nickname}
                {activeConversation.otherUser.isAiManaged && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-primary/20 text-primary font-medium shrink-0" title="Responde por IA">IA</span>
                )}
              </span>
              {activeConversation.otherUser.online && (
                <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" title="Online" />
              )}
            </>
          ) : (
            <span className="font-heading text-sm flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              Conversas
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMaximized(true)}
            aria-label="Maximizar"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          {activeConversationId && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setActiveConversationId(null)}
              aria-label="Voltar à lista"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPanelOpen(false)}
            aria-label="Fechar"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeConversationId && activeConversation ? (
          <ThreadView conversationId={activeConversationId} otherUserName={activeConversation.otherUser.nickname} />
        ) : (
          <ConversationList onSelect={(c: Conversation) => setActiveConversationId(c.id)} />
        )}
      </div>
    </div>
  );
}
