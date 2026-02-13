import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPost } from "@/api/feed";
import { FEED_QUERY_KEY, useDeleteFeedItem } from "@/hooks/useFeed";
import { MainLayout } from "@/components/layout/MainLayout";
import { SidebarLeft } from "@/components/layout/SidebarLeft";
import { SidebarRight } from "@/components/layout/SidebarRight";
import { FeedCard } from "@/components/feed/FeedCard";
import { CommentList } from "@/components/feed/CommentList";
import { toast } from "sonner";

export const POST_QUERY_KEY = (id: string) => ["post", id] as const;

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const deleteFeedItemMutation = useDeleteFeedItem();
  const { data: response, isLoading } = useQuery({
    queryKey: POST_QUERY_KEY(id ?? ""),
    queryFn: () => getPost(id!),
    enabled: Boolean(id),
  });
  const post = response?.post ?? null;

  const invalidate = () => {
    if (id) {
      queryClient.invalidateQueries({ queryKey: POST_QUERY_KEY(id) });
      queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY });
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deleteFeedItemMutation.mutateAsync(postId);
      toast.success("Postagem excluída!");
      navigate("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao excluir postagem.";
      toast.error(message);
    }
  };

  if (!id) {
    return (
      <MainLayout sidebarLeft={<SidebarLeft />} sidebarRight={<SidebarRight />}>
        <p className="text-muted-foreground">Post não encontrado.</p>
      </MainLayout>
    );
  }

  if (isLoading) {
    return (
      <MainLayout sidebarLeft={<SidebarLeft />} sidebarRight={<SidebarRight />}>
        <p className="text-muted-foreground">Carregando...</p>
      </MainLayout>
    );
  }

  if (!post) {
    return (
      <MainLayout sidebarLeft={<SidebarLeft />} sidebarRight={<SidebarRight />}>
        <p className="text-muted-foreground">Post não encontrado.</p>
      </MainLayout>
    );
  }

  return (
    <MainLayout sidebarLeft={<SidebarLeft />} sidebarRight={<SidebarRight />}>
      <div className="flex flex-col min-h-0 h-full overflow-hidden">
        <div className="flex-shrink-0 mb-3">
          <Link
            to="/"
            className="text-[10px] font-heading uppercase tracking-wider text-accent hover:text-tf-yellow-light transition-colors"
          >
            ← Voltar ao feed
          </Link>
        </div>
        <div className="list-scroll flex-1 min-h-0 pr-1 space-y-6">
          <FeedCard item={post} onReactionChange={invalidate} onDelete={() => handleDeletePost(post.id)} />
          <CommentList
            feedItemId={post.id}
            allowComments={post.allowComments !== false}
          />
        </div>
      </div>
    </MainLayout>
  );
}
