import { useRef, useState, useEffect } from "react";
import { isApiConfigured } from "@/api/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AttachmentType } from "@/lib/types";

const ACCEPT = "image/*,video/*,audio/*,.pdf";
const MAX_FILES = 4;
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

function fileToPreviewType(file: File): AttachmentType {
  const t = file.type.toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/") || t === "audio/mp3") return "audio";
  return "document";
}

export interface MediaAttachmentInputProps {
  /** Pending files (upload happens on post submit, not here). */
  value: File[];
  onChange: (files: File[]) => void;
  kind: "feed" | "scrap" | "chat";
  disabled?: boolean;
  maxFiles?: number;
  className?: string;
}

export function MediaAttachmentInput({
  value,
  onChange,
  kind,
  disabled = false,
  maxFiles = MAX_FILES,
  className,
}: MediaAttachmentInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<(string | null)[]>([]);

  const canAdd = value.length < maxFiles && !disabled && isApiConfigured();

  const valueKey = value.map((f) => `${f.name}-${f.size}`).join("|");
  useEffect(() => {
    const urls = value.map((f) =>
      f.type.startsWith("image/") ? URL.createObjectURL(f) : null
    );
    setPreviewUrls(urls);
    return () => urls.forEach((u) => u && URL.revokeObjectURL(u));
  }, [valueKey]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setError(null);
    const toAdd = Math.min(files.length, maxFiles - value.length);
    const next: File[] = [...value];
    for (let i = 0; i < toAdd; i++) {
      const file = files[i];
      if (file.size > MAX_SIZE_BYTES) {
        setError(`Arquivo muito grande: ${file.name}`);
        break;
      }
      next.push(file);
      if (next.length >= maxFiles) break;
    }
    onChange(next);
    e.target.value = "";
  };

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className={cn("space-y-2", className)}>
      {canAdd && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={handleFileSelect}
            disabled={disabled}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-[10px] font-heading uppercase"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || value.length >= maxFiles}
          >
            📎 Anexar mídia
          </Button>
          <span className="text-[10px] text-muted-foreground">
            {value.length}/{maxFiles} (img, vídeo, áudio, PDF). Envio ao publicar.
          </span>
        </div>
      )}
      {error && <p className="text-[10px] text-destructive">{error}</p>}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((file, index) => {
            const type = fileToPreviewType(file);
            const previewUrl = type === "image" ? previewUrls[index] ?? null : null;
            return (
              <div
                key={`${file.name}-${index}-${file.size}`}
                className="relative rounded border border-border bg-muted/50 overflow-hidden group"
              >
                {type === "image" && previewUrl && (
                  <img
                    src={previewUrl}
                    alt=""
                    className="h-16 w-16 object-cover rounded"
                  />
                )}
                {(type === "video" || type === "audio" || type === "document") && (
                  <div className="h-16 w-14 flex items-center justify-center bg-muted text-2xl">
                    {type === "video" && "🎬"}
                    {type === "audio" && "🎵"}
                    {type === "document" && "📄"}
                  </div>
                )}
                <span
                  className="block px-2 py-0.5 text-[9px] text-muted-foreground truncate max-w-[120px]"
                  title={file.name}
                >
                  {file.name}
                </span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="absolute top-0 right-0 rounded-bl bg-destructive/90 text-destructive-foreground text-xs px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remover"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
