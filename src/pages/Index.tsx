import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { SidebarLeft } from "@/components/layout/SidebarLeft";
import { SidebarRight } from "@/components/layout/SidebarRight";
import { FeedCard } from "@/components/feed/FeedCard";
import { EmojiGifInput } from "@/components/ui/EmojiGifInput";
import { MediaAttachmentInput } from "@/components/ui/MediaAttachmentInput";
import { Switch } from "@/components/ui/switch";
import { useQueryClient } from "@tanstack/react-query";
import { uploadFileToR2 } from "@/api/upload";
import { useFeed, usePostFeed, useDeleteFeedItem, FEED_QUERY_KEY } from "@/hooks/useFeed";

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
  const deleteFeedItem = useDeleteFeedItem();
  const [content, setContent] = useState("");
  const [allowComments, setAllowComments] = useState(true);
  const [allowReactions, setAllowReactions] = useState(true);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [compactPostBox, setCompactPostBox] = useState(false);
  const compactPostBoxRef = useRef(false);
  _log("Index.tsx:mount", "Index_mount", { isLoading, feedLen: feed?.length ?? 0 });

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      const listEl = document.querySelector(".list-scroll") as HTMLDivElement | null;
      if (!listEl) return;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrolled = listEl.scrollTop ?? 0;
          
          // Zona de histerese: encolhe aos 50px, expande aos 30px
          // Isso evita mudanças muito frequentes quando está próximo do threshold
          const shouldBeCompact = scrolled > 50;
          const shouldExpand = scrolled < 30;
          
          if (shouldBeCompact && !compactPostBoxRef.current) {
            compactPostBoxRef.current = true;
            setCompactPostBox(true);
          } else if (shouldExpand && compactPostBoxRef.current) {
            compactPostBoxRef.current = false;
            setCompactPostBox(false);
          }
          
          ticking = false;
        });
        ticking = true;
      }
    };

    const listEl = document.querySelector(".list-scroll");
    if (listEl) {
      listEl.addEventListener("scroll", handleScroll, { passive: true });
    }
    return () => {
      if (listEl) {
        listEl.removeEventListener("scroll", handleScroll);
      }
    };
  }, []);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed && attachmentFiles.length === 0) return;
    try {
      const attachments =
        attachmentFiles.length > 0
          ? await Promise.all(attachmentFiles.map((f) => uploadFileToR2(f, "feed")))
          : undefined;
      postFeed.mutate(
        { content: trimmed, allowComments, allowReactions, attachments },
        {
          onSuccess: () => {
            setContent("");
            setAttachmentFiles([]);
            toast.success("Intel enviada!");
          },
          onError: (err) => {
            const message = err instanceof Error ? err.message : "Falha ao enviar. Faça login para publicar.";
            toast.error(message);
          },
        }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload dos anexos.");
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deleteFeedItem.mutateAsync(postId);
      toast.success("Postagem excluída!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao excluir postagem.";
      toast.error(message);
    }
  };

  return (
    <MainLayout
      sidebarLeft={<SidebarLeft />}
      sidebarRight={<SidebarRight />}
    >
      <div className="flex flex-col min-h-0 h-full overflow-hidden">
        {/* Post input */}
        <div
          className={`flex-shrink-0 tf-card transition-all duration-200 ${
            compactPostBox ? "p-2" : "p-4 space-y-3"
          }`}
        >
          <h3 className="font-heading text-xs text-muted-foreground uppercase tracking-widest">
            📡 Transmissão de Campo
          </h3>
          <div
            className={`transition-all duration-200 overflow-hidden ${
              compactPostBox ? "max-h-0 opacity-0" : "max-h-[1000px] opacity-100"
            }`}
          >
            <div className="space-y-3">
              <EmojiGifInput
                value={content}
                onChange={setContent}
                placeholder="Relate sua última batalha, soldado..."
                rows={3}
                disabled={postFeed.isPending}
              />
              <div className="rounded-md border border-border bg-muted/30 px-2.5 py-2 flex items-center flex-wrap gap-3 text-[10px] text-muted-foreground">
                <label className="flex items-center gap-2.5 cursor-pointer group flex-shrink-0">
                  <Switch
                    checked={allowComments}
                    onCheckedChange={setAllowComments}
                    className="data-[state=checked]:bg-accent h-4 w-7 flex-shrink-0 [&>*]:h-3 [&>*]:w-3 [&>*]:data-[state=checked]:translate-x-3"
                  />
                  <span className="group-hover:text-foreground/80 transition-colors whitespace-nowrap">
                    💬 Comentários
                  </span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer group flex-shrink-0">
                  <Switch
                    checked={allowReactions}
                    onCheckedChange={setAllowReactions}
                    className="data-[state=checked]:bg-accent h-4 w-7 flex-shrink-0 [&>*]:h-3 [&>*]:w-3 [&>*]:data-[state=checked]:translate-x-3"
                  />
                  <span className="group-hover:text-foreground/80 transition-colors whitespace-nowrap">
                    👍 Reações
                  </span>
                </label>
              </div>
<MediaAttachmentInput
              kind="feed"
              value={attachmentFiles}
              onChange={setAttachmentFiles}
              disabled={postFeed.isPending}
            />
              <div className="flex justify-end">
                <button
                  type="button"
                  className="px-4 py-2 bg-accent text-accent-foreground font-heading text-xs uppercase tracking-wider rounded tf-shadow-sm hover:brightness-110 transition-all disabled:opacity-50"
                  onClick={handleSubmit}
                  disabled={(!content.trim() && attachmentFiles.length === 0) || postFeed.isPending}
                >
                  🔥 Enviar Intel
                </button>
              </div>
            </div>
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
                  onDelete={() => handleDeletePost(item.id)}
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
