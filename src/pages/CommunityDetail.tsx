import { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import type { User } from "@/lib/types";
import { uploadFileToR2 } from "@/api/upload";
import { CLASS_EMOJIS } from "@/lib/types";
import { MainLayout } from "@/components/layout/MainLayout";
import { SidebarLeft } from "@/components/layout/SidebarLeft";
import { SidebarRight } from "@/components/layout/SidebarRight";
import { FeedCard } from "@/components/feed/FeedCard";
import { EmojiGifInput } from "@/components/ui/EmojiGifInput";
import { MediaAttachmentInput } from "@/components/ui/MediaAttachmentInput";
import { Switch } from "@/components/ui/switch";
import { EditCommunityModal } from "@/components/community/EditCommunityModal";
import { ConfirmDeleteCommunityModal } from "@/components/community/ConfirmDeleteCommunityModal";
import { ConfirmRemoveMemberModal } from "@/components/community/ConfirmRemoveMemberModal";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCommunity,
  useCommunityMembers,
  useCommunityPosts,
  useJoinCommunity,
  useLeaveCommunity,
  useUpdateCommunity,
  useDeleteCommunity,
  useRemoveMember,
  usePostToCommunity,
  COMMUNITY_POSTS_QUERY_KEY,
} from "@/hooks/useCommunities";
import { useDeleteFeedItem } from "@/hooks/useFeed";
import { toast } from "sonner";
import { getStoredToken } from "@/api/auth";

export default function CommunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasToken = Boolean(getStoredToken());
  const { community, isLoading: communityLoading } = useCommunity(id);
  const { members, isLoading: membersLoading } = useCommunityMembers(id);
  const { posts, isLoading: postsLoading } = useCommunityPosts(id);
  const joinMutation = useJoinCommunity(id ?? "");
  const leaveMutation = useLeaveCommunity(id ?? "");
  const updateMutation = useUpdateCommunity(id ?? "");
  const deleteMutation = useDeleteCommunity();
  const removeMemberMutation = useRemoveMember(id ?? "");
  const postMutation = usePostToCommunity(id ?? "");
  const deleteFeedItemMutation = useDeleteFeedItem();

  const location = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removeMemberTarget, setRemoveMemberTarget] = useState<User | null>(null);
  const [postContent, setPostContent] = useState("");
  const [allowComments, setAllowComments] = useState(true);
  const [allowReactions, setAllowReactions] = useState(true);
  const [postAttachmentFiles, setPostAttachmentFiles] = useState<File[]>([]);
  const [compactPostBox, setCompactPostBox] = useState(false);
  const compactPostBoxRef = useRef(false);
  const [mainTab, setMainTab] = useState<"feed" | "members">("feed");
  const [membersTab, setMembersTab] = useState<"all" | "admins" | "members">("all");

  useEffect(() => {
    if (location.hash === "#post" && community?.isMember) {
      // Aguardar um pouco para garantir que o DOM está renderizado
      const timeoutId = setTimeout(() => {
        const el = document.getElementById("post");
        if (el) {
          // Scroll apenas se não estiver visível
          const rect = el.getBoundingClientRect();
          const isVisible = rect.top >= 0 && rect.top <= window.innerHeight;
          if (!isVisible) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [location.hash, community?.isMember]);

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
  }, [mainTab]);

  const handleDelete = async () => {
    if (!id) return;
    await deleteMutation.mutateAsync(id);
    navigate("/communities");
  };

  const handleRemoveMember = async () => {
    if (!removeMemberTarget) return;
    await removeMemberMutation.mutateAsync(removeMemberTarget.id);
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim() && postAttachmentFiles.length === 0) return;
    try {
      const attachments =
        postAttachmentFiles.length > 0
          ? await Promise.all(postAttachmentFiles.map((f) => uploadFileToR2(f, "feed")))
          : undefined;
      await postMutation.mutateAsync({
        content: postContent.trim(),
        allowComments,
        allowReactions,
        attachments,
      });
      setPostContent("");
      setPostAttachmentFiles([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload dos anexos.");
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deleteFeedItemMutation.mutateAsync(postId);
      toast.success("Postagem excluída!");
      if (id) {
        queryClient.invalidateQueries({ queryKey: COMMUNITY_POSTS_QUERY_KEY(id) });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao excluir postagem.";
      toast.error(message);
    }
  };

  if (!id) {
    return (
      <MainLayout sidebarLeft={<SidebarLeft />} sidebarRight={<SidebarRight />}>
        <p className="text-muted-foreground">ID inválido.</p>
      </MainLayout>
    );
  }

  if (communityLoading || !community) {
    return (
      <MainLayout sidebarLeft={<SidebarLeft />} sidebarRight={<SidebarRight />}>
        <p className="text-muted-foreground">{communityLoading ? "Carregando…" : "Comunidade não encontrada."}</p>
      </MainLayout>
    );
  }

  const teamGradient = community.team === "RED"
    ? "team-gradient-red"
    : community.team === "BLU"
    ? "team-gradient-blu"
    : "bg-muted";

  return (
    <MainLayout sidebarLeft={<SidebarLeft />} sidebarRight={<SidebarRight />}>
      <div className="flex flex-col min-h-0 h-full overflow-hidden">
        <div className="flex-shrink-0 mb-3">
          <Link
            to="/communities"
            className="text-[10px] font-heading uppercase tracking-wider text-accent hover:text-tf-yellow-light transition-colors"
          >
            ← Todas as comunidades
          </Link>
        </div>

        {/* Header */}
        <div className={`flex-shrink-0 tf-card overflow-hidden ${teamGradient}`}>
          <div className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-heading text-lg tracking-wider text-card-foreground">
                  {community.name}
                </h1>
                {community.owner && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Dono: {community.owner.nickname}
                  </p>
                )}
                <p className="text-sm text-card-foreground/90 mt-2">{community.description}</p>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                  <span>{community.members} membros</span>
                  {community.dominantClass && (
                    <span>{CLASS_EMOJIS[community.dominantClass]} {community.dominantClass}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {!community.isMember && hasToken && (
                  <button
                    type="button"
                    onClick={() => joinMutation.mutate()}
                    disabled={joinMutation.isPending}
                    className="px-3 py-1.5 rounded font-heading text-[10px] uppercase bg-accent text-accent-foreground tf-shadow-sm hover:brightness-110 disabled:opacity-50"
                  >
                    {joinMutation.isPending ? "…" : "Entrar"}
                  </button>
                )}
                {community.isMember && (
                  <button
                    type="button"
                    onClick={() => leaveMutation.mutate()}
                    disabled={leaveMutation.isPending}
                    className="px-3 py-1.5 rounded font-heading text-[10px] uppercase border border-border hover:bg-muted"
                  >
                    {leaveMutation.isPending ? "…" : "Sair"}
                  </button>
                )}
                {community.isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditOpen(true)}
                      className="px-3 py-1.5 rounded font-heading text-[10px] uppercase border border-border hover:bg-muted"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteOpen(true)}
                      className="px-3 py-1.5 rounded font-heading text-[10px] uppercase bg-destructive/20 text-destructive hover:bg-destructive/30"
                    >
                      Excluir
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="flex-shrink-0 flex gap-1 p-1 bg-muted/50 rounded border border-border mt-4 mb-3">
          <button
            type="button"
            onClick={() => setMainTab("feed")}
            className={`flex-1 py-2 px-3 rounded font-heading text-[10px] uppercase tracking-wider transition-colors ${
              mainTab === "feed"
                ? "bg-accent text-accent-foreground tf-shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Feed
          </button>
          <button
            type="button"
            onClick={() => setMainTab("members")}
            className={`flex-1 py-2 px-3 rounded font-heading text-[10px] uppercase tracking-wider transition-colors ${
              mainTab === "members"
                ? "bg-accent text-accent-foreground tf-shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Membros
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 flex flex-col min-w-0">
          {mainTab === "feed" && (
            <div className="flex flex-col flex-1 min-h-0 min-w-0">
            {community.isMember && (
              <form
                id="post"
                onSubmit={handlePost}
                className={`flex-shrink-0 tf-card mb-2 scroll-mt-4 transition-all duration-200 ${
                  compactPostBox ? "p-2" : "p-4"
                }`}
              >
                <label className="block font-heading text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                  ✏️ Nova publicação
                </label>
                <div
                  className={`transition-all duration-200 overflow-hidden ${
                    compactPostBox ? "max-h-0 opacity-0" : "max-h-[1000px] opacity-100"
                  }`}
                >
                  <div className="space-y-3">
                    <EmojiGifInput
                      value={postContent}
                      onChange={setPostContent}
                      placeholder="O que está acontecendo na comunidade?"
                      rows={3}
                      disabled={postMutation.isPending}
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
                      value={postAttachmentFiles}
                      onChange={setPostAttachmentFiles}
                      disabled={postMutation.isPending}
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={postMutation.isPending || (!postContent.trim() && postAttachmentFiles.length === 0)}
                        className="px-4 py-2 rounded font-heading text-[10px] uppercase bg-accent text-accent-foreground hover:brightness-110 disabled:opacity-50 transition-all"
                      >
                        {postMutation.isPending ? "Enviando…" : "Publicar"}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}
            <div id="community-posts-scroll" className="list-scroll flex-1 min-h-0 pr-1">
              {postsLoading ? (
                <p className="text-muted-foreground text-sm">Carregando…</p>
              ) : posts.length === 0 ? (
                <div className="tf-card p-6 text-center text-muted-foreground text-sm">
                  Nenhuma publicação ainda.
                </div>
              ) : (
                <div className="space-y-3">
                  {posts.map((item) => (
                    <FeedCard
                      key={item.id}
                      item={item}
                      onReactionChange={() => id && queryClient.invalidateQueries({ queryKey: COMMUNITY_POSTS_QUERY_KEY(id) })}
                      onDelete={() => handleDeletePost(item.id)}
                    />
                  ))}
                </div>
              )}
            </div>
            </div>
          )}

          {mainTab === "members" && (
            <div className="flex flex-col flex-1 min-h-0 min-w-0">
            <div className="flex-shrink-0 flex gap-1 p-1 bg-muted/50 rounded border border-border mb-2">
              <button
                type="button"
                onClick={() => setMembersTab("all")}
                className={`flex-1 py-1.5 px-2 rounded font-heading text-[10px] uppercase tracking-wider transition-colors ${
                  membersTab === "all"
                    ? "bg-accent text-accent-foreground tf-shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setMembersTab("admins")}
                className={`flex-1 py-1.5 px-2 rounded font-heading text-[10px] uppercase tracking-wider transition-colors ${
                  membersTab === "admins"
                    ? "bg-accent text-accent-foreground tf-shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                Admins
              </button>
              <button
                type="button"
                onClick={() => setMembersTab("members")}
                className={`flex-1 py-1.5 px-2 rounded font-heading text-[10px] uppercase tracking-wider transition-colors ${
                  membersTab === "members"
                    ? "bg-accent text-accent-foreground tf-shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                Membros
              </button>
            </div>
            <div className="list-scroll flex-1 min-h-0 pr-1">
            {membersLoading ? (
              <p className="text-muted-foreground text-sm">Carregando…</p>
            ) : (
              <div className="space-y-0.5">
                {members
                  .filter((m) => {
                    if (membersTab === "admins") return m.role === "ADMIN";
                    if (membersTab === "members") return m.role !== "ADMIN";
                    return true;
                  })
                  .map((m) => (
                  <div
                    key={m.user.id}
                    className="flex items-center justify-between gap-2 p-2 rounded hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-8 h-8 rounded flex items-center justify-center text-sm border-2 flex-shrink-0
                        ${m.user.team === "RED" ? "border-team-red bg-team-red/10" : "border-team-blu bg-team-blu/10"}`}>
                        {CLASS_EMOJIS[m.user.mainClass]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{m.user.nickname}</p>
                        <p className="text-[10px] text-muted-foreground">{m.role === "ADMIN" ? "Admin" : "Membro"}</p>
                      </div>
                    </div>
                    {community.isAdmin && m.role !== "ADMIN" && community.owner?.id !== m.user.id && (
                      <button
                        type="button"
                        onClick={() => setRemoveMemberTarget(m.user)}
                        className="flex-shrink-0 px-2 py-1 text-[10px] uppercase text-destructive hover:bg-destructive/10 rounded"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            </div>
            </div>
          )}
        </div>
      </div>

      <EditCommunityModal
        open={editOpen}
        onOpenChange={setEditOpen}
        community={community}
        onSubmit={(data) => updateMutation.mutateAsync(data)}
        loading={updateMutation.isPending}
      />
      <ConfirmDeleteCommunityModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        community={community}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
      <ConfirmRemoveMemberModal
        open={!!removeMemberTarget}
        onOpenChange={(open) => !open && setRemoveMemberTarget(null)}
        user={removeMemberTarget}
        onConfirm={handleRemoveMember}
        loading={removeMemberMutation.isPending}
      />
    </MainLayout>
  );
}
