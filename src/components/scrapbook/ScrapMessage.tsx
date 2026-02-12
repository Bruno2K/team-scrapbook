import type { ScrapMessage as ScrapMessageType } from "@/lib/types";
import { CLASS_EMOJIS } from "@/lib/types";

interface ScrapMessageProps {
  scrap: ScrapMessageType;
}

const REACTION_LABELS: Record<string, string> = {
  headshot: "💀 Headshot",
  heal: "💉 Heal",
  burn: "🔥 Burn",
  backstab: "🗡️ Backstab",
};

export function ScrapMessage({ scrap }: ScrapMessageProps) {
  const teamBorder = scrap.from.team === "RED" ? "border-team-red/40" : "border-team-blu/40";

  return (
    <div className={`relative bg-tf-brown/30 border-2 ${teamBorder} rounded p-3 space-y-2 tf-shadow-sm`}>
      {/* Paper texture effect */}
      <div className="absolute inset-0 tf-texture opacity-30 rounded pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">{CLASS_EMOJIS[scrap.from.mainClass]}</span>
            <span className="font-heading text-xs text-card-foreground">{scrap.from.nickname}</span>
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
