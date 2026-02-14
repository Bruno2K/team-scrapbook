import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, Send } from "lucide-react";
import { useSendChatMessage } from "@/hooks/useChat";
import { uploadFileToR2 } from "@/api/upload";
import type { Attachment } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCEPT = "image/*,video/*,audio/*,.pdf";
const MAX_FILES = 4;

function fileToType(file: File): "image" | "video" | "audio" | "document" {
  const t = file.type.toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/") || t === "audio/mp3") return "audio";
  return "document";
}

export interface ChatInputProps {
  conversationId: string;
  onTyping?: () => void;
  disabled?: boolean;
  className?: string;
}

export function ChatInput({
  conversationId,
  onTyping,
  disabled = false,
  className,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendMessage = useSendChatMessage();

  const handleSend = useCallback(async () => {
    const hasText = text.trim().length > 0;
    const hasAttachments = attachments.length > 0 || pendingFiles.length > 0;
    if (!hasText && !hasAttachments) return;
    if (disabled || sending) return;

    setSending(true);
    try {
      let finalAttachments = [...attachments];
      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          const att = await uploadFileToR2(file, "chat");
          finalAttachments.push(att);
        }
        setPendingFiles([]);
      }
      const type =
        finalAttachments.length > 0
          ? finalAttachments[0].type === "image"
            ? "TEXT"
            : finalAttachments[0].type === "video"
              ? "VIDEO"
              : finalAttachments[0].type === "audio"
                ? "AUDIO"
                : "DOCUMENT"
          : "TEXT";
      await sendMessage({
        conversationId,
        content: text.trim() || null,
        type: type as "TEXT" | "AUDIO" | "VIDEO" | "DOCUMENT",
        attachments: finalAttachments.length > 0 ? finalAttachments : undefined,
      });
      setText("");
      setAttachments([]);
    } finally {
      setSending(false);
    }
  }, [text, attachments, pendingFiles, conversationId, disabled, sending, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const toAdd = Math.min(files.length, MAX_FILES - pendingFiles.length - attachments.length);
    for (let i = 0; i < toAdd; i++) {
      const file = files[i];
      setPendingFiles((prev) => [...prev, file]);
    }
    e.target.value = "";
  };

  const removePending = (index: number) => {
    setPendingFiles((p) => p.filter((_, i) => i !== index));
  };
  const removeAttachment = (index: number) => {
    setAttachments((a) => a.filter((_, i) => i !== index));
  };

  return (
    <div className={cn("flex flex-col gap-2 border-t border-border bg-card p-2", className)}>
      {(attachments.length > 0 || pendingFiles.length > 0) && (
        <div className="flex flex-wrap gap-1">
          {attachments.map((a, i) => (
            <span
              key={`a-${i}`}
              className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs"
            >
              {a.type === "image" ? "🖼" : a.type === "video" ? "🎬" : a.type === "audio" ? "🎵" : "📄"}
              <button type="button" onClick={() => removeAttachment(i)} aria-label="Remover">
                ×
              </button>
            </span>
          ))}
          {pendingFiles.map((f, i) => (
            <span
              key={`p-${i}`}
              className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs"
            >
              {f.name}
              <button type="button" onClick={() => removePending(i)} aria-label="Remover">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || pendingFiles.length + attachments.length >= MAX_FILES}
          aria-label="Anexar"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onTyping?.();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Mensagem..."
          disabled={disabled}
          className="flex-1 min-w-0"
        />
        <Button
          type="button"
          size="icon"
          className="shrink-0"
          onClick={handleSend}
          disabled={disabled || sending || (!text.trim() && pendingFiles.length === 0 && attachments.length === 0)}
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
