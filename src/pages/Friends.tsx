import { useState } from "react";
import { Link } from "react-router-dom";
import type { User } from "@/lib/types";
import { MainLayout } from "@/components/layout/MainLayout";
import { SidebarLeft } from "@/components/layout/SidebarLeft";
import { SidebarRight } from "@/components/layout/SidebarRight";
import { FriendCard } from "@/components/friends/FriendCard";
import { ConfirmRemoveFriendModal } from "@/components/friends/ConfirmRemoveFriendModal";
import { ConfirmBlockUserModal } from "@/components/friends/ConfirmBlockUserModal";
import { ConfirmUnblockUserModal } from "@/components/friends/ConfirmUnblockUserModal";
import { SendScrapDialog } from "@/components/scrapbook/SendScrapDialog";
import {
  useFriends,
  useFriendRequests,
  useBlocked,
  useAvailableToAdd,
  useRecommendations,
  useAddFriend,
  useRemoveFriend,
  useBlockUser,
  useUnblockUser,
  useAcceptFriendRequest,
  useDeclineFriendRequest,
} from "@/hooks/useFriends";
import { useGetOrCreateConversation } from "@/hooks/useChat";
import { useChat } from "@/contexts/ChatContext";
import { getStoredToken } from "@/api/auth";
import { toast } from "sonner";

const TABS = [
  { id: "squad" as const, label: "Squad", icon: "⚔️" },
  { id: "recommendations" as const, label: "Recomendados", icon: "⭐" },
  { id: "add" as const, label: "Adicionar amigos", icon: "➕" },
  { id: "blocked" as const, label: "Bloqueados", icon: "🚫" },
];

type TabId = "squad" | "recommendations" | "add" | "blocked";

export default function Friends() {
  const [tab, setTab] = useState<TabId>("squad");
  const [addSearch, setAddSearch] = useState("");
  const { friends, onlineFriends, offlineFriends, isLoading: friendsLoading } = useFriends();
  const { friendRequests, isLoading: requestsLoading } = useFriendRequests();
  const { available, isLoading: availableLoading } = useAvailableToAdd();
  const { recommendations, isLoading: recLoading } = useRecommendations();
  const { blocked, isLoading: blockedLoading } = useBlocked();
  const addFriendMutation = useAddFriend();
  const removeFriendMutation = useRemoveFriend();
  const blockUserMutation = useBlockUser();
  const unblockUserMutation = useUnblockUser();
  const acceptRequestMutation = useAcceptFriendRequest();
  const declineRequestMutation = useDeclineFriendRequest();

  const [removeTarget, setRemoveTarget] = useState<User | null>(null);
  const [blockTarget, setBlockTarget] = useState<User | null>(null);
  const [unblockTarget, setUnblockTarget] = useState<User | null>(null);
  const [scrapTarget, setScrapTarget] = useState<User | null>(null);
  const [scrapDialogOpen, setScrapDialogOpen] = useState(false);

  const hasToken = Boolean(getStoredToken());
  const getOrCreateConversation = useGetOrCreateConversation();
  const { openConversationWith } = useChat();

  const handleChat = async (u: User) => {
    const conv = await getOrCreateConversation(u.id);
    if (conv) openConversationWith(conv);
  };

  const handleSendScrap = (u: User) => {
    setScrapTarget(u);
    setScrapDialogOpen(true);
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    await removeFriendMutation.mutateAsync(removeTarget.id);
  };
  const handleBlock = async () => {
    if (!blockTarget) return;
    await blockUserMutation.mutateAsync(blockTarget.id);
  };
  const handleUnblock = async () => {
    if (!unblockTarget) return;
    await unblockUserMutation.mutateAsync(unblockTarget.id);
  };

  return (
    <MainLayout sidebarLeft={<SidebarLeft />} sidebarRight={<SidebarRight />}>
      <div className="flex flex-col min-h-0 h-full overflow-hidden">
        <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h1 className="font-heading text-sm text-muted-foreground uppercase tracking-widest">
            ⚔️ Squad e amigos
          </h1>
          <Link
            to="/"
            className="text-[10px] font-heading uppercase tracking-wider text-accent hover:text-tf-yellow-light transition-colors"
          >
            ← Voltar ao Feed
          </Link>
        </div>

        <div className="flex-shrink-0 flex flex-wrap gap-1 p-1 bg-muted/50 rounded border border-border mb-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 px-3 rounded font-heading text-[10px] uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-1.5
                ${tab === t.id
                  ? "bg-accent text-accent-foreground tf-shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Content: single scroll area for current tab */}
        <div className="list-scroll pr-1">
        {tab === "squad" && (
          <>
            {friendRequests.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-heading">Solicitações de entrada</p>
                <div className="space-y-2">
                  {friendRequests.map((req) => (
                    <div
                      key={req.id}
                      className="tf-card p-3 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="text-sm font-bold truncate">{req.from.nickname}</span>
                        <span className="text-[10px] text-muted-foreground truncate">quer entrar na squad</span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => acceptRequestMutation.mutate(req.id)}
                          disabled={acceptRequestMutation.isPending}
                          className="px-2 py-1 rounded text-[10px] font-heading uppercase bg-accent text-accent-foreground hover:brightness-110 disabled:opacity-50"
                        >
                          Aceitar
                        </button>
                        <button
                          type="button"
                          onClick={() => declineRequestMutation.mutate(req.id)}
                          disabled={declineRequestMutation.isPending}
                          className="px-2 py-1 rounded text-[10px] font-heading uppercase border border-border hover:bg-muted"
                        >
                          Recusar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {friendsLoading ? (
              <p className="text-muted-foreground text-sm">Carregando squad…</p>
            ) : friends.length === 0 && friendRequests.length === 0 ? (
              <div className="tf-card p-6 text-center text-muted-foreground text-sm">
                <p className="mb-2">Nenhum amigo na squad ainda.</p>
                <p className="text-[10px]">Use a aba &quot;Adicionar amigos&quot; para encontrar agentes ou aceite solicitações acima.</p>
              </div>
            ) : friends.length === 0 ? null : (
              <div className="space-y-2">
                {onlineFriends.length > 0 && (
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Online</p>
                )}
                {onlineFriends.map((u) => (
                  <FriendCard
                    key={u.id}
                    user={u}
                    variant="friend"
                    onChat={hasToken ? handleChat : undefined}
                    onSendScrap={hasToken ? handleSendScrap : undefined}
                    onRemove={() => setRemoveTarget(u)}
                    onBlock={() => setBlockTarget(u)}
                  />
                ))}
                {offlineFriends.length > 0 && (
                  <>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-3 mb-1">Offline</p>
                    {offlineFriends.map((u) => (
                      <FriendCard
                        key={u.id}
                        user={u}
                        variant="friend"
                        onChat={hasToken ? handleChat : undefined}
                        onSendScrap={hasToken ? handleSendScrap : undefined}
                        onRemove={() => setRemoveTarget(u)}
                        onBlock={() => setBlockTarget(u)}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {tab === "add" && (
          <>
            <div className="space-y-4">
              <label className="block">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-heading">Buscar por nome</span>
                <input
                  type="text"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  placeholder="Nickname ou nome..."
                  className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                />
              </label>

              {(availableLoading || recLoading) ? (
                <p className="text-muted-foreground text-sm">Carregando…</p>
              ) : (
                <>
                  {(() => {
                    const q = addSearch.trim().toLowerCase();
                    const filterUser = (u: User) =>
                      !q || u.nickname.toLowerCase().includes(q) || u.name.toLowerCase().includes(q);
                    const recFiltered = recommendations.filter(filterUser);
                    const recIds = new Set(recommendations.map((r) => r.id));
                    const restAvailable = available.filter((u) => !recIds.has(u.id) && filterUser(u));
                    const hasAny = recFiltered.length > 0 || restAvailable.length > 0;

                    if (!hasAny) {
                      return (
                        <div className="tf-card p-6 text-center text-muted-foreground text-sm">
                          {available.length === 0 && recommendations.length === 0
                            ? "Não há usuários para adicionar. Faça login e verifique se a API está rodando."
                            : addSearch.trim()
                              ? "Nenhum resultado para essa busca."
                              : "Não há mais usuários para adicionar. Todos já estão na squad ou bloqueados."}
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {recFiltered.length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-heading">
                              Recomendados (amigos em comum / mesma comunidade)
                            </p>
                            <div className="space-y-0.5">
                              {recFiltered.map((u) => (
                                <FriendCard
                                  key={u.id}
                                  user={u}
                                  variant="available"
                                  onAdd={() =>
                                    addFriendMutation.mutate(u.id, {
                                      onSuccess: (data) => toast.success(data?.message ?? "Solicitação enviada"),
                                    })
                                  }
                                  addLoading={addFriendMutation.isPending}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        {restAvailable.length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-heading">
                              {recFiltered.length > 0 ? "Outros" : "Todos"}
                            </p>
                            <div className="space-y-0.5">
                              {restAvailable.map((u) => (
                                <FriendCard
                                  key={u.id}
                                  user={u}
                                  variant="available"
                                  onAdd={() =>
                                    addFriendMutation.mutate(u.id, {
                                      onSuccess: (data) => toast.success(data?.message ?? "Solicitação enviada"),
                                    })
                                  }
                                  addLoading={addFriendMutation.isPending}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </>
        )}

        {tab === "recommendations" && (
          <>
            <div className="space-y-4">
              <label className="block">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-heading">Buscar por nome</span>
                <input
                  type="text"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  placeholder="Nickname ou nome..."
                  className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                />
              </label>
              {recLoading ? (
                <p className="text-muted-foreground text-sm">Carregando recomendações…</p>
              ) : (() => {
                const q = addSearch.trim().toLowerCase();
                const filterUser = (u: User) =>
                  !q || u.nickname.toLowerCase().includes(q) || u.name.toLowerCase().includes(q);
                const recFiltered = recommendations.filter(filterUser);
                if (recFiltered.length === 0) {
                  return (
                    <div className="tf-card p-6 text-center text-muted-foreground text-sm">
                      {recommendations.length === 0
                        ? "Nenhuma recomendação no momento. Adicione amigos ou entre em comunidades para ver sugestões."
                        : "Nenhum resultado para essa busca."}
                    </div>
                  );
                }
                return (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-heading">
                      Amigos em comum / mesma comunidade
                    </p>
                    <div className="space-y-0.5">
                      {recFiltered.map((u) => (
                        <FriendCard
                          key={u.id}
                          user={u}
                          variant="available"
                          onAdd={() => addFriendMutation.mutate(u.id)}
                          addLoading={addFriendMutation.isPending}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {tab === "blocked" && (
          <>
            {blockedLoading ? (
              <p className="text-muted-foreground text-sm">Carregando…</p>
            ) : blocked.length === 0 ? (
              <div className="tf-card p-6 text-center text-muted-foreground text-sm">
                Nenhum usuário bloqueado.
              </div>
            ) : (
              <div className="space-y-0.5">
                {blocked.map((u) => (
                  <FriendCard
                    key={u.id}
                    user={u}
                    variant="blocked"
                    onUnblock={() => setUnblockTarget(u)}
                    unblockLoading={unblockUserMutation.isPending}
                  />
                ))}
              </div>
            )}
          </>
        )}
        </div>
      </div>

      <ConfirmRemoveFriendModal
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        user={removeTarget}
        onConfirm={handleRemove}
        loading={removeFriendMutation.isPending}
      />
      <ConfirmBlockUserModal
        open={!!blockTarget}
        onOpenChange={(open) => !open && setBlockTarget(null)}
        user={blockTarget}
        onConfirm={handleBlock}
        loading={blockUserMutation.isPending}
      />
      <ConfirmUnblockUserModal
        open={!!unblockTarget}
        onOpenChange={(open) => !open && setUnblockTarget(null)}
        user={unblockTarget}
        onConfirm={handleUnblock}
        loading={unblockUserMutation.isPending}
      />
      <SendScrapDialog
        target={scrapTarget}
        open={scrapDialogOpen}
        onOpenChange={(open) => {
          setScrapDialogOpen(open);
          if (!open) setScrapTarget(null);
        }}
      />
    </MainLayout>
  );
}
