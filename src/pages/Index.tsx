import { useState } from "react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { SidebarLeft } from "@/components/layout/SidebarLeft";
import { SidebarRight } from "@/components/layout/SidebarRight";
import { FeedCard } from "@/components/feed/FeedCard";
import { useFeed, usePostFeed } from "@/hooks/useFeed";

const Index = () => {
  const { feed, isLoading } = useFeed();
  const postFeed = usePostFeed();
  const [content, setContent] = useState("");

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    postFeed.mutate(
      { content: trimmed },
      {
        onSuccess: () => {
          setContent("");
          toast.success("Intel enviada!");
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : "Falha ao enviar. Faça login para publicar.";
          toast.error(message);
        },
      }
    );
  };

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
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={postFeed.isPending}
        />
        <div className="flex justify-end">
          <button
            type="button"
            className="px-4 py-2 bg-accent text-accent-foreground font-heading text-xs uppercase tracking-wider rounded tf-shadow-sm hover:brightness-110 transition-all disabled:opacity-50"
            onClick={handleSubmit}
            disabled={!content.trim() || postFeed.isPending}
          >
            🔥 Enviar Intel
          </button>
        </div>
      </div>

      {/* Feed */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando feed...</p>
      ) : (
        feed.map((item) => (
          <FeedCard key={item.id} item={item} />
        ))
      )}
    </MainLayout>
  );
};

export default Index;
