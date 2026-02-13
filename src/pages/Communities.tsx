import { useState } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { SidebarLeft } from "@/components/layout/SidebarLeft";
import { SidebarRight } from "@/components/layout/SidebarRight";
import { CommunityCard } from "@/components/community/CommunityCard";
import { CreateCommunityModal } from "@/components/community/CreateCommunityModal";
import { useCommunities, useCreateCommunity } from "@/hooks/useCommunities";
import { getStoredToken } from "@/api/auth";

export default function Communities() {
  const { communities, isLoading } = useCommunities();
  const createMutation = useCreateCommunity();
  const [createOpen, setCreateOpen] = useState(false);
  const hasToken = Boolean(getStoredToken());

  return (
    <MainLayout sidebarLeft={<SidebarLeft />} sidebarRight={<SidebarRight />}>
      <div className="flex flex-col min-h-0 h-full overflow-hidden">
        <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
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

        <div className="list-scroll pr-1">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando comunidades…</p>
          ) : communities.length === 0 ? (
            <div className="tf-card p-6 text-center text-muted-foreground text-sm">
              Nenhuma comunidade ainda. {hasToken && "Crie a primeira!"}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {communities.map((c) => (
                <CommunityCard key={c.id} community={c} />
              ))}
            </div>
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
