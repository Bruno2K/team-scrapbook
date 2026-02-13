import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { SidebarLeft } from "@/components/layout/SidebarLeft";
import { SidebarRight } from "@/components/layout/SidebarRight";
import { CommunityCard } from "@/components/community/CommunityCard";
import { CreateCommunityModal } from "@/components/community/CreateCommunityModal";
import { useCommunities, useMyCommunities, useRecommendedCommunities, useCreateCommunity } from "@/hooks/useCommunities";
import type { Community } from "@/lib/types";
import { getStoredToken } from "@/api/auth";

const TABS = [
  { id: "recommendations" as const, label: "Recomendações", icon: "⭐" },
  { id: "mine" as const, label: "Minhas comunidades", icon: "🏠" },
  { id: "all" as const, label: "Todas as comunidades", icon: "🏰" },
];

type TabId = "recommendations" | "mine" | "all";

function filterBySearch(list: Community[], search: string): Community[] {
  const q = search.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
  );
}

export default function Communities() {
  const [tab, setTab] = useState<TabId>("recommendations");
  const [search, setSearch] = useState("");
  const { communities: allCommunities, isLoading: allLoading } = useCommunities({ search: search.trim() || undefined });
  const { communities: myCommunities, isLoading: myLoading } = useMyCommunities();
  const { communities: recommended, isLoading: recLoading } = useRecommendedCommunities();
  const createMutation = useCreateCommunity();
  const [createOpen, setCreateOpen] = useState(false);
  const hasToken = Boolean(getStoredToken());

  const filteredRecommendations = useMemo(() => filterBySearch(recommended, search), [recommended, search]);
  const filteredMine = useMemo(() => filterBySearch(myCommunities, search), [myCommunities, search]);
  const filteredAll = useMemo(() => allCommunities, [allCommunities]);

  return (
    <MainLayout sidebarLeft={<SidebarLeft />} sidebarRight={<SidebarRight />}>
      <div className="flex flex-col min-h-0 h-full overflow-hidden">
        <div className="flex-shrink-0 flex flex-col gap-3 mb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h1 className="font-heading text-sm text-muted-foreground uppercase tracking-widest">
              🏰 Comunidades
            </h1>
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="text-[10px] font-heading uppercase tracking-wider text-accent hover:text-tf-yellow-light transition-colors"
              >
                ← Voltar ao Feed
              </Link>
              {hasToken && (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="px-3 py-1.5 rounded font-heading text-[10px] uppercase tracking-wider bg-accent text-accent-foreground tf-shadow-sm hover:brightness-110"
                >
                  + Criar comunidade
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1 p-1 bg-muted/50 rounded border border-border">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex-1 min-w-0 py-2 px-3 rounded font-heading text-[10px] uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-1.5
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

          <label className="block">
            <span className="sr-only">Buscar comunidades</span>
            <input
              type="search"
              placeholder="Buscar comunidades..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-md bg-muted border-2 border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent"
            />
          </label>
        </div>

        <div className="list-scroll pr-1">
          {tab === "recommendations" && (
            <>
              {!hasToken ? (
                <div className="tf-card p-6 text-center text-muted-foreground text-sm">
                  Faça login para ver comunidades recomendadas com base nos seus amigos.
                </div>
              ) : recLoading ? (
                <p className="text-muted-foreground text-sm">Carregando recomendações…</p>
              ) : filteredRecommendations.length === 0 ? (
                <div className="tf-card p-6 text-center text-muted-foreground text-sm">
                  {recommended.length === 0
                    ? "Nenhuma recomendação no momento. Amigos em comunidades que você ainda não entrou aparecem aqui."
                    : "Nenhum resultado para essa busca."}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredRecommendations.map((c) => (
                    <CommunityCard key={c.id} community={c} friendsInCommunity={c.friendsInCommunity} />
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "mine" && (
            <>
              {!hasToken ? (
                <div className="tf-card p-6 text-center text-muted-foreground text-sm">
                  Faça login para ver as comunidades em que você participa.
                </div>
              ) : myLoading ? (
                <p className="text-muted-foreground text-sm">Carregando minhas comunidades…</p>
              ) : filteredMine.length === 0 ? (
                <div className="tf-card p-6 text-center text-muted-foreground text-sm">
                  {myCommunities.length === 0
                    ? "Você não está em nenhuma comunidade ainda. Use a aba &quot;Todas as comunidades&quot; para explorar."
                    : "Nenhum resultado para essa busca."}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredMine.map((c) => (
                    <CommunityCard key={c.id} community={c} friendsInCommunity={c.friendsInCommunity} />
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "all" && (
            <>
              {allLoading ? (
                <p className="text-muted-foreground text-sm">Carregando comunidades…</p>
              ) : filteredAll.length === 0 ? (
                <div className="tf-card p-6 text-center text-muted-foreground text-sm">
                  Nenhuma comunidade encontrada. {hasToken && "Crie a primeira!"}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredAll.map((c) => (
                    <CommunityCard key={c.id} community={c} friendsInCommunity={c.friendsInCommunity} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <CreateCommunityModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(data) => createMutation.mutateAsync(data).then(() => setCreateOpen(false))}
        loading={createMutation.isPending}
      />
    </MainLayout>
  );
}
