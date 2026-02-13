import type { ScrapMessage as ScrapMessageType } from "@/lib/types";
import { CLASS_EMOJIS } from "@/lib/types";

interface ScrapMessageProps {
  scrap: ScrapMessageType;
  /** When true, shows "De:" / "Para:" and uses the other user for style (for full scraps page) */
  showDirection?: boolean;
}

const REACTION_LABELS: Record<string, string> = {
  headshot: "💀 Headshot",
  heal: "💉 Heal",
  burn: "🔥 Burn",
  backstab: "🗡️ Backstab",
};

export function ScrapMessage({ scrap, showDirection }: ScrapMessageProps) {
  const isSent = scrap.direction === "sent" && scrap.to;
  const otherUser = isSent ? scrap.to : scrap.from;
  if (!otherUser) return null;

  const teamBorder = otherUser.team === "RED" ? "border-team-red/40" : "border-team-blu/40";
  const classEmoji = CLASS_EMOJIS[otherUser.mainClass as keyof typeof CLASS_EMOJIS] ?? "👤";
  const label = showDirection
    ? isSent
      ? "Para"
      : "De"
    : null;

  return (
    <div className={`relative bg-tf-brown border-2 ${teamBorder} rounded p-3 space-y-2 tf-shadow-sm`}>
      {/* Paper texture effect */}
      <div className="absolute inset-0 tf-texture opacity-20 rounded pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">{classEmoji}</span>
            {label && (
              <span className="text-[10px] text-muted-foreground uppercase font-heading">{label}:</span>
            )}
            <span className="font-heading text-xs text-card-foreground">{otherUser.nickname}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">{scrap.timestamp}</span>
        </div>

        <p className="text-sm text-card-foreground mt-1 italic">"{scrap.content}"</p>

        {scrap.reaction && (
          <div className="mt-2">
            <span className="inline-block px-2 py-0.5 bg-muted rounded border border-border text-[10px] font-bold uppercase">
              {REACTION_LABELS[scrap.reaction]}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
