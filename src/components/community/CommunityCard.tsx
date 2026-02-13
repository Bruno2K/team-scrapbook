import { Link } from "react-router-dom";
import type { Community, User } from "@/lib/types";
import { CLASS_EMOJIS } from "@/lib/types";

const MAX_AVATARS = 5;

function FriendAvatar({ user }: { user: User }) {
  const initial = user.nickname?.slice(0, 1).toUpperCase() || user.name?.slice(0, 1).toUpperCase() || "?";
  const tooltipText = user.nickname ? `${user.name} (@${user.nickname})` : user.name;
  return (
    <span className="group relative inline-flex flex-shrink-0">
      <span
        className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted border border-border text-[10px] font-bold text-muted-foreground overflow-hidden"
      >
        {user.avatar ? (
          <img src={user.avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </span>
      <span
        role="tooltip"
        className="absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-[10px] font-medium text-background opacity-0 shadow-md pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:delay-200 delay-0"
      >
        {tooltipText}
      </span>
    </span>
  );
}

export interface CommunityCardProps {
  community: Community;
  /** Optional override; defaults to community.friendsInCommunity */
  friendsInCommunity?: User[];
}

export function CommunityCard({ community, friendsInCommunity: friendsProp }: CommunityCardProps) {
  const friendsInCommunity = friendsProp ?? community.friendsInCommunity;
  const teamGradient = community.team === "RED"
    ? "team-gradient-red"
    : community.team === "BLU"
    ? "team-gradient-blu"
    : "bg-muted";

  const showFriends = friendsInCommunity?.length
    ? friendsInCommunity.slice(0, MAX_AVATARS)
    : [];
  const extraCount = friendsInCommunity ? Math.max(0, friendsInCommunity.length - MAX_AVATARS) : 0;

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
        {showFriends.length > 0 && (
          <div className="flex items-center gap-1 pt-1 border-t border-border">
            <span className="text-[10px] text-muted-foreground mr-1">Amigos:</span>
            <div className="flex -space-x-1.5">
              {showFriends.map((u) => (
                <FriendAvatar key={u.id} user={u} />
              ))}
              {extraCount > 0 && (
                <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted border border-border text-[10px] font-bold text-muted-foreground">
                  +{extraCount}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
