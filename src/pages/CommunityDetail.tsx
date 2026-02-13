import { useState, useEffect } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import type { User } from "@/lib/types";
import { CLASS_EMOJIS } from "@/lib/types";
import { MainLayout } from "@/components/layout/MainLayout";
import { SidebarLeft } from "@/components/layout/SidebarLeft";
import { SidebarRight } from "@/components/layout/SidebarRight";
import { FeedCard } from "@/components/feed/FeedCard";
import { EmojiGifInput } from "@/components/ui/EmojiGifInput";
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

  const location = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removeMemberTarget, setRemoveMemberTarget] = useState<User | null>(null);
  const [postContent, setPostContent] = useState("");
  const [allowComments, setAllowComments] = useState(true);
  const [allowReactions, setAllowReactions] = useState(true);

  useEffect(() => {
    if (location.hash === "#post" && community?.isMember) {
      const el = document.getElementById("post");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash, community?.isMember]);

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
    if (!postContent.trim()) return;
    await postMutation.mutateAsync({
      content: postContent.trim(),
      allowComments,
      allowReactions,
    });
    setPostContent("");
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

        <div className="flex-1 min-h-0 grid gap-4 lg:grid-cols-3 mt-4">
          {/* Posts */}
          <div className="lg:col-span-2 flex flex-col min-h-0 min-w-0">
            <h2 className="flex-shrink-0 font-heading text-xs text-muted-foreground uppercase tracking-widest mb-2">
              Publicações
            </h2>
            {community.isMember && (
              <form id="post" onSubmit={handlePost} className="flex-shrink-0 tf-card p-4 mb-2 scroll-mt-4">
                <label className="block font-heading text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                  ✏️ Nova publicação
                </label>
                <EmojiGifInput
                  value={postContent}
                  onChange={setPostContent}
                  placeholder="O que está acontecendo na comunidade?"
                  rows={3}
                  disabled={postMutation.isPending}
                />
                <div className="flex flex-wrap gap-4 items-center my-2">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowComments}
                      onChange={(e) => setAllowComments(e.target.checked)}
                      className="rounded border-border"
                    />
                    Permitir comentários
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowReactions}
                      onChange={(e) => setAllowReactions(e.target.checked)}
                      className="rounded border-border"
                    />
                    Permitir reações
                  </label>
                </div>
                <div className="flex justify-end mt-2">
                  <button
                    type="submit"
                    disabled={postMutation.isPending || !postContent.trim()}
                    className="px-4 py-2 rounded font-heading text-[10px] uppercase bg-accent text-accent-foreground hover:brightness-110 disabled:opacity-50 transition-all"
                  >
                    {postMutation.isPending ? "Enviando…" : "Publicar"}
                  </button>
                </div>
              </form>
            )}
            <div className="list-scroll pr-1">
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
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Members */}
          <div className="flex flex-col min-h-0 min-w-0">
            <h2 className="flex-shrink-0 font-heading text-xs text-muted-foreground uppercase tracking-widest mb-2">
              Membros
            </h2>
            <div className="list-scroll pr-1">
            {membersLoading ? (
              <p className="text-muted-foreground text-sm">Carregando…</p>
            ) : (
              <div className="space-y-0.5">
                {members.map((m) => (
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
