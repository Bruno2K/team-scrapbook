import { Link } from "react-router-dom";
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
    <Link to={`/communities/${community.id}`} className="block tf-card overflow-hidden hover:ring-2 hover:ring-accent/50 transition-all">
      {/* Banner */}
      <div className={`${teamGradient} px-4 py-2.5 flex items-center justify-between gap-2 min-h-0`}>
        <span className="font-heading text-xs uppercase tracking-widest text-primary-foreground line-clamp-2 break-words leading-tight">
          {community.name}
        </span>
        {community.dominantClass && (
          <span className="text-base">{CLASS_EMOJIS[community.dominantClass]}</span>
        )}
      </div>

      <div className="p-4 space-y-3 overflow-hidden">
        <p className="text-sm text-muted-foreground line-clamp-3 leading-snug break-words">{community.description}</p>
        <div className="flex items-center justify-between gap-3 pt-0.5">
          <span className="text-xs font-bold text-accent">
            {community.members.toLocaleString()} membros
          </span>
          <span className="px-3 py-1.5 bg-accent text-accent-foreground font-heading text-[10px] uppercase rounded tf-shadow-sm flex-shrink-0">
            Ver
          </span>
        </div>
      </div>
    </Link>
  );
}
