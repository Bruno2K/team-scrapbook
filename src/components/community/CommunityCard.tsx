import type { Community } from "@/lib/types";
import { CLASS_EMOJIS } from "@/lib/types";

interface CommunityCardProps {
  community: Community;
}

export function CommunityCard({ community }: CommunityCardProps) {
  const teamGradient = community.team === "RED"
    ? "team-gradient-red"
    : community.team === "BLU"
    ? "team-gradient-blu"
    : "bg-muted";

  return (
    <div className="tf-card overflow-hidden">
      {/* Banner */}
      <div className={`${teamGradient} px-3 py-2 flex items-center justify-between`}>
        <span className="font-heading text-[10px] uppercase tracking-widest text-primary-foreground truncate">
          {community.name}
        </span>
        {community.dominantClass && (
          <span className="text-sm">{CLASS_EMOJIS[community.dominantClass]}</span>
        )}
      </div>

      <div className="p-3 space-y-2">
        <p className="text-xs text-muted-foreground">{community.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-accent">
            {community.members.toLocaleString()} membros
          </span>
          <button className="px-2 py-1 bg-accent text-accent-foreground font-heading text-[10px] uppercase rounded tf-shadow-sm hover:brightness-110 transition-all">
            Entrar
          </button>
        </div>
      </div>
    </div>
  );
}
