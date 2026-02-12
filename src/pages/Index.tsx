import { MainLayout } from "@/components/layout/MainLayout";
import { SidebarLeft } from "@/components/layout/SidebarLeft";
import { SidebarRight } from "@/components/layout/SidebarRight";
import { FeedCard } from "@/components/feed/FeedCard";
import { useFeed } from "@/hooks/useFeed";

const Index = () => {
  const { feed } = useFeed();

  return (
    <MainLayout
      sidebarLeft={<SidebarLeft />}
      sidebarRight={<SidebarRight />}
    >
      {/* Post input */}
      <div className="tf-card p-4 space-y-3">
        <h3 className="font-heading text-xs text-muted-foreground uppercase tracking-widest">
          📡 Transmissão de Campo
        </h3>
        <textarea
          placeholder="Relate sua última batalha, soldado..."
          className="w-full bg-muted border-2 border-border rounded p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-accent transition-colors"
          rows={3}
        />
        <div className="flex justify-end">
          <button className="px-4 py-2 bg-accent text-accent-foreground font-heading text-xs uppercase tracking-wider rounded tf-shadow-sm hover:brightness-110 transition-all">
            🔥 Enviar Intel
          </button>
        </div>
      </div>

      {/* Feed */}
      {feed.map((item) => (
        <FeedCard key={item.id} item={item} />
      ))}
    </MainLayout>
  );
};

export default Index;
