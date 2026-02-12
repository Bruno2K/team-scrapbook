import { FriendCard } from "@/components/friends/FriendCard";
import { CommunityCard } from "@/components/community/CommunityCard";
import { useFriends } from "@/hooks/useFriends";
import { useCommunities } from "@/hooks/useCommunities";

export function SidebarRight() {
  const { onlineFriends, offlineFriends } = useFriends();
  const { communities } = useCommunities();

  return (
    <>
      {/* Friends */}
      <div className="tf-card p-4 space-y-2">
        <h3 className="font-heading text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          ⚔️ Squad
          <span className="ml-auto text-[10px] text-accent font-bold">{onlineFriends.length} online</span>
        </h3>

        <div className="space-y-0.5">
          {onlineFriends.map((u) => (
            <FriendCard key={u.id} user={u} />
          ))}
        </div>

        {offlineFriends.length > 0 && (
          <>
            <div className="border-t border-border pt-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Offline</p>
            </div>
            <div className="space-y-0.5">
              {offlineFriends.map((u) => (
                <FriendCard key={u.id} user={u} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Communities */}
      <div className="space-y-2">
        <h3 className="font-heading text-xs text-muted-foreground uppercase tracking-widest px-1 flex items-center gap-2">
          🏰 Comunidades
        </h3>
        {communities.slice(0, 4).map((c) => (
          <CommunityCard key={c.id} community={c} />
        ))}
        <button className="w-full text-[10px] font-bold uppercase text-accent hover:text-tf-yellow-light transition-colors text-center py-1">
          Ver todas as comunidades →
        </button>
      </div>
    </>
  );
}
