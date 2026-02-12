import { useUser } from "@/hooks/useUser";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { ScrapMessage } from "@/components/scrapbook/ScrapMessage";
import { MOCK_SCRAPS } from "@/lib/mockData";

export function SidebarLeft() {
  const { user } = useUser();

  return (
    <>
      <ProfileCard user={user} />

      {/* Scrapbook */}
      <div className="tf-card p-4 space-y-3">
        <h3 className="font-heading text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          📝 Recados
          <span className="ml-auto text-[10px] text-accent font-bold">{MOCK_SCRAPS.length}</span>
        </h3>
        <div className="space-y-2">
          {MOCK_SCRAPS.slice(0, 3).map((scrap) => (
            <ScrapMessage key={scrap.id} scrap={scrap} />
          ))}
        </div>
        <button className="w-full text-[10px] font-bold uppercase text-accent hover:text-tf-yellow-light transition-colors text-center py-1">
          Ver todos os recados →
        </button>
      </div>
    </>
  );
}
