import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface ChatMessageBubbleProps {
  message: ChatMessageType;
  isOwn: boolean;
}

export function ChatMessageBubble({ message, isOwn }: ChatMessageBubbleProps) {
  return (
    <div
      className={cn(
        "flex gap-2 max-w-[85%]",
        isOwn && "ml-auto flex-row-reverse"
      )}
    >
      {!isOwn && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={message.sender.avatar || undefined} alt="" />
          <AvatarFallback className="text-xs">
            {message.sender.nickname.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "rounded-lg px-3 py-2 text-sm",
          isOwn
            ? "bg-accent text-accent-foreground"
            : "bg-muted"
        )}
      >
        {!isOwn && (
          <span className="text-[10px] font-medium text-muted-foreground block mb-0.5">
            {message.sender.nickname}
          </span>
        )}
        {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
        {message.attachments?.map((att, i) => (
          <div key={i} className="mt-1">
            {att.type === "image" && (
              <a href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                <img src={att.url} alt="" className="max-w-full max-h-48 rounded object-cover" />
              </a>
            )}
            {att.type === "video" && (
              <video src={att.url} controls className="max-w-full max-h-48 rounded" />
            )}
            {att.type === "audio" && (
              <audio src={att.url} controls className="max-w-full" />
            )}
            {(att.type === "document" || !["image", "video", "audio"].includes(att.type)) && (
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline"
              >
                {att.filename || "Documento"}
              </a>
            )}
          </div>
        ))}
        <span
          className={cn(
            "text-[10px] mt-1 block",
            isOwn ? "text-accent-foreground/80" : "text-muted-foreground"
          )}
        >
          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true, locale: ptBR })}
        </span>
      </div>
    </div>
  );
}
