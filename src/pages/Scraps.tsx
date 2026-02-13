import { useState } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { SidebarLeft } from "@/components/layout/SidebarLeft";
import { SidebarRight } from "@/components/layout/SidebarRight";
import { ScrapMessage } from "@/components/scrapbook/ScrapMessage";
import { useScraps } from "@/hooks/useScraps";
import type { ScrapFilter } from "@/lib/types";

const FILTERS: { value: ScrapFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "received", label: "Recebidos" },
  { value: "sent", label: "Enviados" },
];

export default function Scraps() {
  const [filter, setFilter] = useState<ScrapFilter>("all");
  const { scraps, isLoading } = useScraps(filter);

  return (
    <MainLayout
      sidebarLeft={<SidebarLeft />}
      sidebarRight={<SidebarRight />}
    >
      <div className="flex flex-col min-h-0 h-full overflow-hidden">
        <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h1 className="font-heading text-sm text-muted-foreground uppercase tracking-widest">
            📝 Recados
          </h1>
          <Link
            to="/"
            className="text-[10px] font-heading uppercase tracking-wider text-accent hover:text-tf-yellow-light transition-colors"
          >
            ← Voltar ao Feed
          </Link>
        </div>

        <div className="flex-shrink-0 flex gap-1 p-1 bg-muted/50 rounded border border-border mb-3">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`flex-1 py-2 px-3 rounded font-heading text-[10px] uppercase tracking-wider transition-colors
                ${filter === f.value
                  ? "bg-accent text-accent-foreground tf-shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="list-scroll pr-1">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando recados...</p>
          ) : scraps.length === 0 ? (
            <div className="tf-card p-6 text-center text-muted-foreground text-sm">
              {filter === "received" && "Nenhum recado recebido."}
              {filter === "sent" && "Você ainda não enviou nenhum recado."}
              {filter === "all" && "Nenhum recado."}
            </div>
          ) : (
            <div className="space-y-3">
              {scraps.map((scrap) => (
                <ScrapMessage key={scrap.id} scrap={scrap} showDirection />
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
