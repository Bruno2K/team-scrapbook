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
    <div className={`${cardClass} overflow-hidden max-h-full`}>
      {/* Header banner */}
      <div className={`${gradientClass} px-4 py-3 flex items-center justify-between flex-shrink-0`}>
        <span className="font-heading text-sm uppercase tracking-widest text-primary-foreground">
          Team {user.team}
        </span>
        <span className="text-xs font-bold text-primary-foreground/80">
          LVL {user.level}
        </span>
      </div>

      {/* Avatar + Info */}
      <div className="p-4 space-y-4 min-h-0 overflow-hidden">
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Avatar */}
          <div className={`w-14 h-14 rounded-lg border-2 flex items-center justify-center text-2xl flex-shrink-0
            ${user.team === "RED" ? "border-team-red bg-team-red/10" : "border-team-blu bg-team-blu/10"}`}>
            {CLASS_EMOJIS[user.mainClass]}
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <h3 className="font-heading text-sm text-card-foreground line-clamp-2 break-words leading-tight">{user.name}</h3>
            <p className="text-xs text-muted-foreground break-all mt-0.5">@{user.nickname}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold text-accent">{rank}</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">{user.mainClass}</span>
            </div>
            {user.steamProfileUrl && (
              <a
                href={user.steamProfileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-accent hover:underline mt-1 inline-block"
              >
                Steam
              </a>
            )}
          </div>
        </div>

        {user.steamTotalPlaytimeMinutes != null && user.steamTotalPlaytimeMinutes > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {Math.round(user.steamTotalPlaytimeMinutes / 60)}h jogadas na Steam
          </p>
        )}

        {/* Reputation */}
        {user.reputation.length > 0 && (
          <div className="space-y-2 flex-shrink-0">
            <h4 className="font-heading text-[10px] text-muted-foreground uppercase tracking-widest">
              Reputação
            </h4>
            <div className="flex flex-wrap gap-2">
              {user.reputation.map((rep) => (
                <ReputationBadge key={rep} badge={rep} />
              ))}
            </div>
          </div>
        )}

        {/* Achievements: only pinned, max 8 to keep card compact */}
        {(() => {
          const pinnedIds = user.pinnedAchievementIds ?? [];
          const pinned = (user.achievements ?? []).filter((a) => pinnedIds.includes(a.id)).slice(0, 8);
          if (pinned.length === 0) return null;
          return (
            <div className="space-y-2 flex-shrink-0">
              <h4 className="font-heading text-[10px] text-muted-foreground uppercase tracking-widest">
                Conquistas
              </h4>
              <AchievementGrid achievements={pinned} />
            </div>
          );
        })()}
      </div>
    </div>
  );
}
