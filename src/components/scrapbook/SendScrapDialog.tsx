import { useState } from "react";
import { toast } from "sonner";
import type { User } from "@/lib/types";
import { usePostScrap } from "@/hooks/useScraps";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmojiGifInput } from "@/components/ui/EmojiGifInput";
import { Label } from "@/components/ui/label";
import { CLASS_EMOJIS } from "@/lib/types";

const REACTIONS = [
  { value: "", label: "Nenhuma" },
  { value: "headshot", label: "💀 Headshot" },
  { value: "heal", label: "💉 Heal" },
  { value: "burn", label: "🔥 Burn" },
  { value: "backstab", label: "🗡️ Backstab" },
] as const;

interface SendScrapDialogProps {
  target: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendScrapDialog({ target, open, onOpenChange }: SendScrapDialogProps) {
  const [content, setContent] = useState("");
  const [reaction, setReaction] = useState<"" | "headshot" | "heal" | "burn" | "backstab">("");
  const postScrap = usePostScrap();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    const trimmed = content.trim();
    if (!trimmed) {
      toast.error("Escreva o recado.");
      return;
    }
    postScrap.mutate(
      {
        toUserId: target.id,
        content: trimmed,
        ...(reaction ? { reaction } : {}),
      },
      {
        onSuccess: () => {
          toast.success("Recado enviado!");
          setContent("");
          setReaction("");
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Falha ao enviar recado.");
        },
      }
    );
  };

  if (!target) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tf-card border-2 border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-sm uppercase tracking-wider flex items-center gap-2">
            <span>{CLASS_EMOJIS[target.mainClass]}</span>
            Enviar recado para {target.nickname}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="font-heading text-[10px] uppercase tracking-wider text-muted-foreground">
              Recado
            </Label>
            <EmojiGifInput
              value={content}
              onChange={setContent}
              placeholder="Escreva seu recado..."
              rows={3}
              className="mt-1.5"
              disabled={postScrap.isPending}
            />
          </div>
          <div>
            <Label className="font-heading text-[10px] uppercase tracking-wider text-muted-foreground">
              Reação (opcional)
            </Label>
            <select
              value={reaction}
              onChange={(e) => setReaction(e.target.value as typeof reaction)}
              className="mt-1.5 w-full bg-muted border-2 border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent"
              disabled={postScrap.isPending}
            >
              {REACTIONS.map((r) => (
                <option key={r.value || "none"} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={postScrap.isPending}
              className="font-heading text-xs uppercase"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!content.trim() || postScrap.isPending}
              className="bg-accent text-accent-foreground font-heading text-xs uppercase hover:bg-accent/90"
            >
              {postScrap.isPending ? "Enviando..." : "📝 Enviar recado"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
