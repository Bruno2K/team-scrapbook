import { Link } from "react-router-dom";
import { useUser } from "@/hooks/useUser";
import { useScraps } from "@/hooks/useScraps";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { ScrapMessage } from "@/components/scrapbook/ScrapMessage";

export function SidebarLeft() {
  const { user } = useUser();
  const { scraps } = useScraps();

  return (
    <>
      <div className="flex-shrink-0 min-h-0 max-h-[100vh] overflow-hidden">
        <ProfileCard user={user} />
      </div>

      {/* Scrapbook: cabe na tela, sem scroll; ver todos em /scraps */}
      <div className="flex-shrink-0 min-h-0 max-h-[30vh] overflow-hidden tf-card flex flex-col mt-4">
        <div className="p-5 flex flex-col flex-1 min-h-0">
          <h3 className="font-heading text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2 flex-shrink-0 mb-3">
            📝 Recados
            <span className="ml-auto text-[10px] text-accent font-bold">{scraps.length}</span>
          </h3>
          <div className="space-y-3 min-h-0 overflow-hidden">
            {scraps.slice(0, 3).map((scrap) => (
              <ScrapMessage key={scrap.id} scrap={scrap} />
            ))}
          </div>
          <Link
            to="/scraps"
            className="flex-shrink-0 block w-full text-[10px] font-bold uppercase text-accent hover:text-tf-yellow-light transition-colors text-center py-2.5 mt-4"
          >
            Ver todos os recados →
          </Link>
        </div>
      </div>
    </>
  );
}
