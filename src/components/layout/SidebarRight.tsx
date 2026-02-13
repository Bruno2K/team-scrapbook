import { useState } from "react";
import { Link } from "react-router-dom";
import type { User } from "@/lib/types";
import { FriendCard } from "@/components/friends/FriendCard";
import { CommunityCard } from "@/components/community/CommunityCard";
import { SendScrapDialog } from "@/components/scrapbook/SendScrapDialog";
import { useFriends } from "@/hooks/useFriends";
import { useMyCommunities } from "@/hooks/useCommunities";
import { getStoredToken } from "@/api/auth";

export function SidebarRight() {
  const { onlineFriends, offlineFriends } = useFriends();
  const { communities } = useMyCommunities();
  const [scrapTarget, setScrapTarget] = useState<User | null>(null);
  const [scrapDialogOpen, setScrapDialogOpen] = useState(false);
  const hasToken = Boolean(getStoredToken());

  const handleSendScrap = (user: User) => {
    setScrapTarget(user);
    setScrapDialogOpen(true);
  };

  const showFriends = [...onlineFriends, ...offlineFriends].slice(0, 4);

  return (
    <>
      {/* Squad: cabe na tela, sem scroll; gerenciar em /friends */}
      <div className="flex-shrink-0 min-h-0 max-h-[50vh] overflow-hidden tf-card flex flex-col">
        <div className="p-5 flex flex-col flex-1 min-h-0">
          <h3 className="font-heading text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2 flex-shrink-0 mb-3">
            ⚔️ Squad
            <span className="ml-auto text-[10px] text-accent font-bold">{onlineFriends.length} online</span>
          </h3>
          <div className="space-y-1 min-h-0 overflow-hidden">
            {showFriends.map((u) => (
              <FriendCard key={u.id} user={u} variant="friend" onSendScrap={hasToken ? handleSendScrap : undefined} />
            ))}
          </div>
          <Link
            to="/friends"
            className="flex-shrink-0 block w-full text-[10px] font-bold uppercase text-accent hover:text-tf-yellow-light transition-colors text-center py-2.5 mt-4"
          >
            Gerenciar squad →
          </Link>
        </div>
      </div>

      <SendScrapDialog
        target={scrapTarget}
        open={scrapDialogOpen}
        onOpenChange={(open) => {
          setScrapDialogOpen(open);
          if (!open) setScrapTarget(null);
        }}
      />

      {/* Comunidades: só as que faço parte; ver todas em /communities */}
      <div className="flex-shrink-0 min-h-0 max-h-[50vh] overflow-hidden flex flex-col mt-4">
        <h3 className="font-heading text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2 flex-shrink-0 px-1 mb-3">
          🏰 Comunidades
        </h3>
        <div className="space-y-3 min-h-0 overflow-hidden">
          {!hasToken ? (
            <p className="text-xs text-muted-foreground px-1">Faça login para ver suas comunidades</p>
          ) : communities.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1">Você não está em nenhuma comunidade</p>
          ) : (
            communities.slice(0, 2).map((c) => (
              <CommunityCard key={c.id} community={c} />
            ))
          )}
        </div>
        <Link
          to="/communities"
          className="flex-shrink-0 block w-full text-[10px] font-bold uppercase text-accent hover:text-tf-yellow-light transition-colors text-center py-2.5 mt-4"
        >
          Ver todas as comunidades →
        </Link>
      </div>
    </>
  );
}
