import { useState } from "react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { SidebarLeft } from "@/components/layout/SidebarLeft";
import { SidebarRight } from "@/components/layout/SidebarRight";
import { FeedCard } from "@/components/feed/FeedCard";
import { EmojiGifInput } from "@/components/ui/EmojiGifInput";
import { Switch } from "@/components/ui/switch";
import { useQueryClient } from "@tanstack/react-query";
import { useFeed, usePostFeed, FEED_QUERY_KEY } from "@/hooks/useFeed";

// #region agent log
const _log = (loc: string, msg: string, data: Record<string, unknown>) => {
  fetch("http://127.0.0.1:7243/ingest/a5d22442-9ad0-4754-8b54-cb093bb3d2cf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location: loc, message: msg, data, timestamp: Date.now(), hypothesisId: "H2" }),
  }).catch(() => {});
};
// #endregion

const Index = () => {
  const queryClient = useQueryClient();
  const { feed, isLoading } = useFeed();
  const postFeed = usePostFeed();
  const [content, setContent] = useState("");
  const [allowComments, setAllowComments] = useState(true);
  const [allowReactions, setAllowReactions] = useState(true);
  _log("Index.tsx:mount", "Index_mount", { isLoading, feedLen: feed?.length ?? 0 });

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    postFeed.mutate(
      { content: trimmed, allowComments, allowReactions },
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
      <div className="flex flex-col min-h-0 h-full overflow-hidden">
        {/* Post input */}
        <div className="flex-shrink-0 tf-card p-4 space-y-3">
          <h3 className="font-heading text-xs text-muted-foreground uppercase tracking-widest">
            📡 Transmissão de Campo
          </h3>
          <EmojiGifInput
            value={content}
            onChange={setContent}
            placeholder="Relate sua última batalha, soldado..."
            rows={3}
            disabled={postFeed.isPending}
          />
          <div className="rounded-md border border-border bg-muted/30 p-3 flex flex-wrap gap-6 items-center">
            <span className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground w-full sm:w-auto">
              Opções da publicação
            </span>
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <Switch
                checked={allowComments}
                onCheckedChange={setAllowComments}
                className="data-[state=checked]:bg-accent"
              />
              <span className="text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors">
                💬 Permitir comentários
              </span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <Switch
                checked={allowReactions}
                onCheckedChange={setAllowReactions}
                className="data-[state=checked]:bg-accent"
              />
              <span className="text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors">
                👍 Permitir reações
              </span>
            </label>
          </div>
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

        {/* Feed: scroll only this list */}
        <div className="list-scroll mt-4 pr-1">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando feed...</p>
          ) : (
            <div className="space-y-4">
              {feed.map((item) => (
                <FeedCard
                  key={item.id}
                  item={item}
                  onReactionChange={() => queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY })}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
