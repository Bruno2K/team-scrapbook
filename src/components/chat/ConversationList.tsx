import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useChatConversations } from "@/hooks/useChat";
import type { Conversation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface ConversationListProps {
  onSelect: (conversation: Conversation) => void;
  className?: string;
}

export function ConversationList({ onSelect, className }: ConversationListProps) {
  const { data: conversations, isLoading } = useChatConversations();

  return (
    <div className={cn("list-scroll", className)}>
      {isLoading ? (
        <div className="p-4 text-sm text-muted-foreground">
          Carregando conversas...
        </div>
      ) : !conversations?.length ? (
        <div className="p-4 text-sm text-muted-foreground text-center">
          Nenhuma conversa. Adicione um amigo e clique em &quot;Conversar&quot; na página Squad.
        </div>
      ) : (
    <ul className="divide-y divide-border">
      {conversations.map((conv) => (
        <li key={conv.id}>
          <button
            type="button"
            className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 text-left transition-colors"
            onClick={() => onSelect(conv)}
          >
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={conv.otherUser.avatar || undefined} alt="" />
              <AvatarFallback>{conv.otherUser.nickname.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate flex items-center gap-1.5">
                  {conv.otherUser.nickname}
                  {conv.otherUser.isAiManaged && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium shrink-0" title="Responde por IA">
                      IA
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(conv.lastActivityAt), { addSuffix: true, locale: ptBR })}
                </span>
              </div>
              {conv.lastMessagePreview && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {conv.lastMessagePreview.content || "📎"}
                </p>
              )}
            </div>
            {conv.otherUser.online && (
              <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" title="Online" />
            )}
          </button>
        </li>
      ))}
    </ul>
      )}
    </div>
  );
}
