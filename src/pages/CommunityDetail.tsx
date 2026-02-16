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
import { ConfirmRoleChangeModal } from "@/components/community/ConfirmRoleChangeModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  useMyPendingJoinRequest,
  useCommunityJoinRequests,
  useCreateJoinRequest,
  useApproveJoinRequest,
  useRejectJoinRequest,
  usePostInvite,
  useUpdateMemberRole,
  useMyPendingInvites,
  useAcceptCommunityInvite,
  COMMUNITY_POSTS_QUERY_KEY,
  MY_PENDING_INVITES_QUERY_KEY,
} from "@/hooks/useCommunities";
import type { CommunityMemberRoleValue } from "@/api/communities";
import { useFriends } from "@/hooks/useFriends";
import { useDeleteFeedItem } from "@/hooks/useFeed";
import { toast } from "sonner";
import { getStoredToken, getCurrentUserId } from "@/api/auth";

export default function CommunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasToken = Boolean(getStoredToken());
  const { community, isLoading: communityLoading } = useCommunity(id);
  const canAccessFeedAndMembers = community != null && (community.isMember || !community.isPrivate);
  const { members, isLoading: membersLoading } = useCommunityMembers(canAccessFeedAndMembers ? id : undefined);
  const { posts, isLoading: postsLoading } = useCommunityPosts(canAccessFeedAndMembers ? id : undefined);
  const joinMutation = useJoinCommunity(id ?? "");
  const leaveMutation = useLeaveCommunity(id ?? "");
  const updateMutation = useUpdateCommunity(id ?? "");
  const deleteMutation = useDeleteCommunity();
  const removeMemberMutation = useRemoveMember(id ?? "");
  const postMutation = usePostToCommunity(id ?? "");
  const deleteFeedItemMutation = useDeleteFeedItem();
  const { pendingRequest } = useMyPendingJoinRequest(id);
  const { joinRequests } = useCommunityJoinRequests(community?.isAdmin && community?.isPrivate ? id : undefined);
  const createJoinRequestMutation = useCreateJoinRequest(id ?? "");
  const approveJoinRequestMutation = useApproveJoinRequest(id ?? "");
  const rejectJoinRequestMutation = useRejectJoinRequest(id ?? "");
  const postInviteMutation = usePostInvite(id ?? "");
  const updateMemberRoleMutation = useUpdateMemberRole(id ?? "");
  const { friends } = useFriends();
  const { pendingInvites } = useMyPendingInvites();
  const acceptInviteMutation = useAcceptCommunityInvite(id ?? "");
  const pendingInviteForCommunity = id ? pendingInvites.find((inv) => inv.communityId === id) : null;

  const location = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removeMemberTarget, setRemoveMemberTarget] = useState<User | null>(null);
  const [pendingRoleChange, setPendingRoleChange] = useState<{ user: User; newRole: CommunityMemberRoleValue } | null>(null);
  const [postContent, setPostContent] = useState("");
  const [allowComments, setAllowComments] = useState(true);
  const [allowReactions, setAllowReactions] = useState(true);
  const [postAttachmentFiles, setPostAttachmentFiles] = useState<File[]>([]);
  const [compactPostBox, setCompactPostBox] = useState(false);
  const compactPostBoxRef = useRef(false);
  const [mainTab, setMainTab] = useState<"feed" | "members">("feed");
  const [membersTab, setMembersTab] = useState<"all" | "admins" | "members">("all");
  const [inviteUserId, setInviteUserId] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  useEffect(() => {
    if (id && hasToken) {
      queryClient.invalidateQueries({ queryKey: MY_PENDING_INVITES_QUERY_KEY });
    }
  }, [id, hasToken, queryClient]);

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
                  <>
                    {community.isPrivate ? (
                      pendingInviteForCommunity ? (
                        <button
                          type="button"
                          onClick={() => acceptInviteMutation.mutate(pendingInviteForCommunity.id)}
                          disabled={acceptInviteMutation.isPending}
                          className="px-3 py-1.5 rounded font-heading text-[10px] uppercase bg-accent text-accent-foreground tf-shadow-sm hover:brightness-110 disabled:opacity-50"
                        >
                          {acceptInviteMutation.isPending ? "…" : "Aceitar convite"}
                        </button>
                      ) : pendingRequest?.pending ? (
                        <span className="px-3 py-1.5 rounded font-heading text-[10px] uppercase bg-muted text-muted-foreground">
                          Solicitação enviada
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => createJoinRequestMutation.mutate()}
                          disabled={createJoinRequestMutation.isPending}
                          className="px-3 py-1.5 rounded font-heading text-[10px] uppercase bg-accent text-accent-foreground tf-shadow-sm hover:brightness-110 disabled:opacity-50"
                        >
                          {createJoinRequestMutation.isPending ? "…" : "Solicitar entrada"}
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => joinMutation.mutate()}
                        disabled={joinMutation.isPending}
                        className="px-3 py-1.5 rounded font-heading text-[10px] uppercase bg-accent text-accent-foreground tf-shadow-sm hover:brightness-110 disabled:opacity-50"
                      >
                        {joinMutation.isPending ? "…" : "Entrar"}
                      </button>
                    )}
                  </>
                )}
                {community.isMember && (
                  <button
                    type="button"
                    onClick={() => setLeaveConfirmOpen(true)}
                    disabled={leaveMutation.isPending}
                    className="px-3 py-1.5 rounded font-heading text-[10px] uppercase border border-border hover:bg-muted"
                  >
                    {leaveMutation.isPending ? "…" : "Sair"}
                  </button>
                )}
                {community.isAdmin && (
                  <>
                    {community.isPrivate && (
                      <button
                        type="button"
                        onClick={() => setManageOpen(true)}
                        className="px-3 py-1.5 rounded font-heading text-[10px] uppercase border border-border hover:bg-muted"
                      >
                        Gerenciar
                      </button>
                    )}
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

        {/* Main Tabs: hide for non-members of private community */}
        {(!community.isPrivate || community.isMember) && (
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
        )}

        {/* Content */}
        <div className="flex-1 min-h-0 flex flex-col min-w-0">
          {!community.isMember && community.isPrivate ? (
            <div className="tf-card p-6 text-center text-muted-foreground text-sm mt-4">
              Esta comunidade é privada. Solicite entrada ou aguarde um convite para ver o feed e os membros.
            </div>
          ) : mainTab === "feed" && (
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
                      canModerate={community.isModerator ?? false}
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
                        <p className="text-[10px] text-muted-foreground">
                          {m.role === "ADMIN" ? "Admin" : m.role === "MODERATOR" ? "Moderador" : "Membro"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {community.isAdmin && community.owner?.id !== m.user.id && (
                        <select
                          value={pendingRoleChange?.user.id === m.user.id ? pendingRoleChange.newRole : m.role}
                          onChange={(e) => {
                            const newRole = e.target.value as CommunityMemberRoleValue;
                            if (newRole !== m.role) setPendingRoleChange({ user: m.user, newRole });
                          }}
                          disabled={updateMemberRoleMutation.isPending}
                          className="rounded border border-input bg-background px-2 py-1 text-[10px]"
                        >
                          <option value="MEMBER">Membro</option>
                          <option value="MODERATOR">Moderador</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      )}
                      {community.isAdmin && community.owner?.id !== m.user.id && (m.role !== "ADMIN" || community.owner?.id === getCurrentUserId()) && (
                        <button
                          type="button"
                          onClick={() => setRemoveMemberTarget(m.user)}
                          className="px-2 py-1 text-[10px] uppercase text-destructive hover:bg-destructive/10 rounded"
                        >
                          Remover
                        </button>
                      )}
                    </div>
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
      <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair da comunidade?</AlertDialogTitle>
            <AlertDialogDescription>
              {community
                ? `Você deixará de ser membro de "${community.name}". Poderá solicitar entrada novamente depois.`
                : "Você deixará de ser membro desta comunidade."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaveMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); leaveMutation.mutate(undefined, { onSettled: () => setLeaveConfirmOpen(false) }); }}
              disabled={leaveMutation.isPending}
            >
              {leaveMutation.isPending ? "Saindo…" : "Sair"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ConfirmRoleChangeModal
        open={!!pendingRoleChange}
        onOpenChange={(open) => !open && setPendingRoleChange(null)}
        user={pendingRoleChange?.user ?? null}
        newRole={pendingRoleChange?.newRole ?? null}
        onConfirm={() => {
          if (pendingRoleChange) {
            updateMemberRoleMutation.mutate(
              { userId: pendingRoleChange.user.id, role: pendingRoleChange.newRole },
              { onSettled: () => setPendingRoleChange(null) }
            );
          }
        }}
        loading={updateMemberRoleMutation.isPending}
      />
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar comunidade privada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {joinRequests.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Solicitações de entrada</p>
                <ul className="space-y-2">
                  {joinRequests.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0">
                      <span className="text-sm truncate">
                        {r.user.name} (@{r.user.nickname})
                      </span>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => approveJoinRequestMutation.mutate(r.id)}
                          disabled={approveJoinRequestMutation.isPending}
                          className="px-2 py-1 rounded text-[10px] font-heading uppercase bg-accent text-accent-foreground hover:brightness-110 disabled:opacity-50"
                        >
                          Aprovar
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectJoinRequestMutation.mutate(r.id)}
                          disabled={rejectJoinRequestMutation.isPending}
                          className="px-2 py-1 rounded text-[10px] font-heading uppercase border border-border hover:bg-muted"
                        >
                          Recusar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Convidar usuário</p>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={inviteUserId}
                  onChange={(e) => setInviteUserId(e.target.value)}
                  className="rounded border border-input bg-background px-2 py-1.5 text-sm min-w-[140px]"
                >
                  <option value="">Selecione um usuário</option>
                  {friends
                    .filter((u) => !members.some((m) => m.user.id === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nickname}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (inviteUserId) {
                      postInviteMutation.mutate(inviteUserId);
                      setInviteUserId("");
                    }
                  }}
                  disabled={!inviteUserId || postInviteMutation.isPending}
                  className="px-3 py-1.5 rounded font-heading text-[10px] uppercase bg-accent text-accent-foreground tf-shadow-sm hover:brightness-110 disabled:opacity-50"
                >
                  {postInviteMutation.isPending ? "…" : "Convidar"}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
