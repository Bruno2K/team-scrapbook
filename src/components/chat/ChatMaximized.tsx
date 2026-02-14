import { Button } from "@/components/ui/button";
import { useChat } from "@/contexts/ChatContext";
import { useChatConversations } from "@/hooks/useChat";
import { ConversationList } from "./ConversationList";
import { ThreadView } from "./ThreadView";
import type { Conversation } from "@/lib/types";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChatMaximized() {
  const { isMaximized, setMaximized, activeConversationId, setActiveConversationId } = useChat();
  const { data: conversations } = useChatConversations();
  const activeConversation = conversations?.find((c) => c.id === activeConversationId);

  if (!isMaximized) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      <header className="flex-shrink-0 flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-card">
        <h2 className="font-heading text-lg">Chat</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setMaximized(false)}
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </Button>
      </header>
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <aside
          className={cn(
            "w-80 flex-shrink-0 border-r border-border flex flex-col overflow-hidden",
            activeConversationId && "hidden md:flex"
          )}
        >
          <ConversationList
            onSelect={(c: Conversation) => setActiveConversationId(c.id)}
            className="flex-1 overflow-y-auto"
          />
        </aside>
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-muted/30">
          {activeConversation ? (
            <>
              <div className="flex-shrink-0 px-4 py-2 border-b border-border bg-card flex items-center gap-2">
                <span className="font-medium flex items-center gap-2">
                  {activeConversation.otherUser.nickname}
                  {activeConversation.otherUser.isAiManaged && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium" title="Responde por IA">IA</span>
                  )}
                </span>
                {activeConversation.otherUser.online && (
                  <span className="h-2 w-2 rounded-full bg-green-500" title="Online" />
                )}
              </div>
              <ThreadView conversationId={activeConversationId!} />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Selecione uma conversa ou inicie uma pela página Squad.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
