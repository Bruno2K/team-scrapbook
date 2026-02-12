import type { User, TF2Class } from "@/lib/types";
import { getRank, CLASS_EMOJIS } from "@/lib/types";
import { AchievementGrid } from "./AchievementGrid";
import { ReputationBadge } from "./ReputationBadge";

interface ProfileCardProps {
  user: User;
}

const CLASS_COLORS: Record<string, string> = {
  RED: "tf-card-red",
  BLU: "tf-card-blu",
};

export function ProfileCard({ user }: ProfileCardProps) {
  const cardClass = CLASS_COLORS[user.team] || "tf-card";
  const gradientClass = user.team === "RED" ? "team-gradient-red" : "team-gradient-blu";
  const rank = getRank(user.level);

  return (
    <div className={`${cardClass} overflow-hidden`}>
      {/* Header banner */}
      <div className={`${gradientClass} px-4 py-3 flex items-center justify-between`}>
        <span className="font-heading text-sm uppercase tracking-widest text-primary-foreground">
          Team {user.team}
        </span>
        <span className="text-xs font-bold text-primary-foreground/80">
          LVL {user.level}
        </span>
      </div>

      {/* Avatar + Info */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className={`w-16 h-16 rounded-md border-[3px] flex items-center justify-center text-3xl
            ${user.team === "RED" ? "border-team-red bg-team-red/10" : "border-team-blu bg-team-blu/10"}`}>
            {CLASS_EMOJIS[user.mainClass]}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading text-sm truncate text-card-foreground">{user.name}</h3>
            <p className="text-xs text-muted-foreground">@{user.nickname}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold text-accent">{rank}</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">{user.mainClass}</span>
            </div>
          </div>
        </div>

        {/* Add to Squad button */}
        <button className={`w-full py-2 px-4 font-heading text-xs uppercase tracking-wider rounded tf-shadow-sm
          transition-all hover:translate-y-[-1px] hover:brightness-110
          ${user.team === "RED" 
            ? "bg-team-red text-primary-foreground" 
            : "bg-team-blu text-secondary-foreground"
          }`}>
          ⚔️ Adicionar ao Squad
        </button>

        {/* Reputation */}
        {user.reputation.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="font-heading text-[10px] text-muted-foreground uppercase tracking-widest">
              Reputação
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {user.reputation.map((rep) => (
                <ReputationBadge key={rep} badge={rep} />
              ))}
            </div>
          </div>
        )}

        {/* Achievements */}
        {user.achievements.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="font-heading text-[10px] text-muted-foreground uppercase tracking-widest">
              Medalhas
            </h4>
            <AchievementGrid achievements={user.achievements} />
          </div>
        )}
      </div>
    </div>
  );
}
