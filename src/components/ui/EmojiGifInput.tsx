import { useRef, useCallback, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  ContentWithMedia,
  parseContentToTextAndMedia,
  contentWithoutUrl,
  type MediaSegment,
} from "@/components/ui/ContentWithMedia";
import { GifPicker } from "@/components/ui/GifPicker";
import { cn } from "@/lib/utils";

const EMOJI_LIST = [
  "😀", "😃", "😄", "😁", "🔥", "❤️", "👍", "👎", "😂", "🤣",
  "😊", "😍", "🤔", "😎", "🎉", "💀", "💉", "🗡️", "🏆", "⭐",
  "😢", "😡", "🤯", "👏", "🙌", "💪", "🎮", "🔫", "💣", "🩹",
];

const DEFAULT_MAX_HEIGHT_PX = 240;

interface EmojiGifInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  /** Max height in pixels; beyond this the textarea scrolls. Default 240. */
  maxHeight?: number;
  className?: string;
  disabled?: boolean;
  id?: string;
}

function insertAtCursor(
  current: string,
  insert: string,
  start: number,
  end: number
): string {
  return current.slice(0, start) + insert + current.slice(end);
}

export function EmojiGifInput({
  value,
  onChange,
  placeholder,
  rows = 3,
  maxHeight = DEFAULT_MAX_HEIGHT_PX,
  className,
  disabled,
  id,
}: EmojiGifInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const safeValue = value ?? "";
  const { textOnly, media } = parseContentToTextAndMedia(safeValue);
  const displayValue = media.length > 0 ? textOnly : safeValue;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const h = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${h}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [maxHeight]);

  useEffect(() => {
    adjustHeight();
  }, [displayValue, adjustHeight]);

  const insertAtSelection = useCallback(
    (text: string) => {
      const el = textareaRef.current;
      const newContent = media.length ? `${textOnly}\n${media.map((m) => m.url).join("\n")}` : safeValue;
      if (!el) {
        onChange(newContent + text);
        return;
      }
      const start = el.selectionStart ?? textOnly.length;
      const end = el.selectionEnd ?? textOnly.length;
      const next = insertAtCursor(textOnly, text, start, end) + (media.length ? "\n" + media.map((m) => m.url).join("\n") : "");
      onChange(next);
      setTimeout(() => {
        el.focus();
        const newPos = start + text.length;
        el.setSelectionRange(newPos, newPos);
      }, 0);
    },
    [safeValue, textOnly, media, onChange]
  );

  const handleTextChange = useCallback(
    (newText: string) => {
      if (media.length) {
        onChange(newText + "\n" + media.map((m) => m.url).join("\n"));
      } else {
        onChange(newText);
      }
    },
    [media, onChange]
  );

  const handleRemoveMedia = useCallback(
    (url: string) => {
      onChange(contentWithoutUrl(safeValue, url));
    },
    [safeValue, onChange]
  );

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex gap-1 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-heading uppercase"
              disabled={disabled}
            >
              😀 Emoji
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-6 gap-0.5 max-h-40 overflow-y-auto">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-muted text-lg"
                  onClick={() => insertAtSelection(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-heading uppercase"
              disabled={disabled}
            >
              GIF
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 max-h-[70vh] overflow-hidden flex flex-col p-0" align="start">
            <GifPicker
              onInsert={(url) => {
                onChange(safeValue.trim() ? safeValue + "\n" + url : safeValue + url);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      <textarea
        ref={textareaRef}
        id={id}
        value={displayValue}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className="w-full rounded border-2 border-border bg-background px-3 py-2 text-sm resize-none placeholder:text-muted-foreground focus:border-accent focus:outline-none min-h-0 overflow-y-hidden"
        style={{ maxHeight: `${maxHeight}px` }}
      />
      {media.length > 0 && (
        <div className="rounded border border-border bg-muted/30 p-2 mt-1 space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase font-heading">Anexos</p>
          {media.map((m) => (
            <AttachmentPreview key={m.url} segment={m} onRemove={() => handleRemoveMedia(m.url)} />
          ))}
        </div>
      )}
    </div>
  );
}

function AttachmentPreview({ segment, onRemove }: { segment: MediaSegment; onRemove: () => void }) {
  return (
    <div className="relative rounded border border-border bg-background overflow-hidden group">
      {segment.type === "img" ? (
        <img src={segment.src} alt="" className="w-full max-h-48 object-contain" />
      ) : (
        <div className="aspect-video w-full max-h-48">
          <iframe
            src={`https://www.youtube.com/embed/${segment.videoId}`}
            title="YouTube"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 px-2 py-1 rounded bg-destructive/90 text-destructive-foreground text-[10px] font-heading uppercase opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
      >
        Remover
      </button>
    </div>
  );
}
