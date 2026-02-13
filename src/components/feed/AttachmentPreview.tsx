import type { Attachment } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AttachmentPreviewProps {
  attachments: Attachment[];
  className?: string;
}

export function AttachmentPreview({ attachments, className }: AttachmentPreviewProps) {
  if (!attachments?.length) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-2 gap-2 max-w-full">
        {attachments.map((att, index) => (
          <div key={`${att.url}-${index}`} className="min-w-0">
            {att.type === "image" && (
              <img
                src={att.url}
                alt=""
                className="rounded max-h-64 w-full object-contain bg-muted/30"
              />
            )}
            {att.type === "video" && (
              <video
                src={att.url}
                controls
                className="rounded max-h-64 w-full bg-muted/30"
              />
            )}
            {att.type === "audio" && (
              <div className="rounded border border-border bg-muted/30 p-2">
                <audio src={att.url} controls className="w-full max-w-full" />
                {att.filename && (
                  <p className="text-[10px] text-muted-foreground truncate mt-1" title={att.filename}>
                    {att.filename}
                  </p>
                )}
              </div>
            )}
            {att.type === "document" && (
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded border border-border bg-muted/30 p-2 hover:bg-muted/50 transition-colors text-sm text-card-foreground"
              >
                <span className="text-lg" aria-hidden>📄</span>
                <span className="truncate flex-1 min-w-0">
                  {att.filename ?? "Documento"}
                </span>
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
