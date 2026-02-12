import type { FeedItem } from "@/lib/types";
import { CLASS_EMOJIS } from "@/lib/types";

interface FeedCardProps {
  item: FeedItem;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  post: { label: "POST", color: "bg-muted text-muted-foreground" },
  achievement: { label: "CONQUISTA", color: "bg-tf-yellow/20 text-tf-yellow" },
  community: { label: "COMUNIDADE", color: "bg-team-blu/20 text-team-blu-light" },
  scrap: { label: "SCRAP", color: "bg-team-red/20 text-team-red-light" },
};

export function FeedCard({ item }: FeedCardProps) {
  const borderClass = item.user.team === "RED" ? "border-l-team-red" : "border-l-team-blu";
  const typeInfo = TYPE_LABELS[item.type] || TYPE_LABELS.post;

  return (
    <div className={`tf-card border-l-4 ${borderClass} p-4 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded flex items-center justify-center text-lg border-2
          ${item.user.team === "RED" ? "border-team-red bg-team-red/10" : "border-team-blu bg-team-blu/10"}`}>
          {CLASS_EMOJIS[item.user.mainClass]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-heading text-xs text-card-foreground truncate">{item.user.nickname}</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${typeInfo.color}`}>
              {typeInfo.label}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">{item.timestamp}</span>
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-card-foreground leading-relaxed">{item.content}</p>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1 border-t border-border">
        <button className="text-[10px] font-bold uppercase text-muted-foreground hover:text-accent transition-colors">
          💀 Headshot
        </button>
        <button className="text-[10px] font-bold uppercase text-muted-foreground hover:text-accent transition-colors">
          💉 Heal
        </button>
        <button className="text-[10px] font-bold uppercase text-muted-foreground hover:text-accent transition-colors">
          🔥 Burn
        </button>
        <button className="text-[10px] font-bold uppercase text-muted-foreground hover:text-accent transition-colors">
          🗡️ Backstab
        </button>
      </div>
    </div>
  );
}
