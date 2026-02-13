import { useEffect, useState, useRef, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { SidebarLeft } from "@/components/layout/SidebarLeft";
import { SidebarRight } from "@/components/layout/SidebarRight";
import { FeedCard } from "@/components/feed/FeedCard";
import { EmojiGifInput } from "@/components/ui/EmojiGifInput";
import { MediaAttachmentInput } from "@/components/ui/MediaAttachmentInput";
import { Switch } from "@/components/ui/switch";
import { useUser, useMeQueryKey } from "@/hooks/useUser";
import { useMyFeed, usePostFeed, useDeleteFeedItem, MY_FEED_QUERY_KEY } from "@/hooks/useFeed";
import { useFriends } from "@/hooks/useFriends";
import { useMyCommunities } from "@/hooks/useCommunities";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { ChevronDown, X } from "lucide-react";
import { getRank, CLASS_EMOJIS } from "@/lib/types";
import { isApiConfigured } from "@/api/client";
import {
  updatePinnedPosts,
  getUserById,
  getUserFeed,
  getUserFriends,
  getUserCommunities,
  getUserMedia,
} from "@/api/user";
import { uploadFileToR2 } from "@/api/upload";
import type { User } from "@/lib/types";
import type { FeedItem } from "@/lib/types";

const MAX_PINNED = 3;

const PROFILE_TABS = [
  { id: "postagens" as const, label: "Postagens" },
  { id: "midia" as const, label: "Mídia" },
  { id: "amigos" as const, label: "Amigos" },
  { id: "steam" as const, label: "Steam" },
  { id: "comunidades" as const, label: "Comunidades" },
];
type ProfileTabId = (typeof PROFILE_TABS)[number]["id"];

const FEED_TYPE_FILTERS = [
  { id: "all" as const, label: "Todos" },
  { id: "scrap" as const, label: "Recado" },
  { id: "post" as const, label: "Post" },
  { id: "community" as const, label: "Comunidade" },
];
type FeedTypeFilterId = (typeof FEED_TYPE_FILTERS)[number]["id"];

const STEAM_SUB_TABS = [
  { id: "resumo" as const, label: "Resumo geral", icon: "📊" },
  { id: "conquistas" as const, label: "Conquistas", icon: "🏆" },
  { id: "jogos" as const, label: "Jogos", icon: "📋" },
];
type SteamSubTabId = (typeof STEAM_SUB_TABS)[number]["id"];

export default function Profile() {
  const { userId: paramUserId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const { user: currentUser, refetch: refetchUser } = useUser();
  const meKey = useMeQueryKey();

  useEffect(() => {
    if (paramUserId === "me") navigate("/profile", { replace: true });
  }, [paramUserId, navigate]);
  const queryClient = useQueryClient();
  const isOwnProfile = paramUserId == null || paramUserId === "me" || currentUser?.id === paramUserId;
  const profileUserId = isOwnProfile ? currentUser?.id ?? null : paramUserId && paramUserId !== "me" ? paramUserId : null;

  const { data: profileUserFromApi } = useQuery({
    queryKey: ["user", profileUserId],
    queryFn: () => getUserById(profileUserId!),
    enabled: profileUserId != null && !isOwnProfile,
  });

  const { data: otherUserFeed, isLoading: otherFeedLoading } = useQuery({
    queryKey: ["feed", profileUserId],
    queryFn: () => getUserFeed(profileUserId!),
    enabled: profileUserId != null && !isOwnProfile,
  });

  const { feed: myFeed, isLoading: myFeedLoading } = useMyFeed();
  const feed = isOwnProfile ? myFeed : otherUserFeed ?? [];
  const feedLoading = isOwnProfile ? myFeedLoading : otherFeedLoading;

  const { friends: myFriends } = useFriends();
  const { communities: myCommunities } = useMyCommunities();

  const { data: otherUserFriends } = useQuery({
    queryKey: ["userFriends", profileUserId],
    queryFn: () => getUserFriends(profileUserId!),
    enabled: profileUserId != null && !isOwnProfile,
  });

  const { data: otherUserCommunities } = useQuery({
    queryKey: ["userCommunities", profileUserId],
    queryFn: () => getUserCommunities(profileUserId!),
    enabled: profileUserId != null && !isOwnProfile,
  });

  const { data: profileMediaData } = useQuery({
    queryKey: ["userMedia", profileUserId],
    queryFn: () => getUserMedia(profileUserId!),
    enabled: profileUserId != null,
  });

  const profileFriends = isOwnProfile ? myFriends : (otherUserFriends ?? []);
  const profileCommunities = isOwnProfile ? myCommunities : (otherUserCommunities ?? []);
  const profileMedia = profileMediaData?.items ?? [];

  const friendsInCommon = useMemo(() => {
    if (isOwnProfile || !otherUserFriends?.length || !myFriends?.length) return [];
    const myIds = new Set(myFriends.map((f) => f.id));
    return otherUserFriends.filter((f) => myIds.has(f.id));
  }, [isOwnProfile, otherUserFriends, myFriends]);

  const profileUser: User | null = isOwnProfile ? currentUser ?? null : profileUserFromApi ?? null;

  const steamAchievementsByGame = useMemo(() => {
    const u = profileUser;
    if (!u?.achievements?.length) return {} as Record<string, { id: string; title: string; icon: string; description: string }[]>;
    return u.achievements.reduce((acc, ach) => {
      const firstDashIndex = ach.id.indexOf("-");
      const appId = firstDashIndex > 0 ? ach.id.substring(0, firstDashIndex) : ach.id;
      if (!acc[appId]) acc[appId] = [];
      acc[appId].push(ach);
      return acc;
    }, {} as Record<string, { id: string; title: string; icon: string; description: string }[]>);
  }, [profileUser?.id, profileUser?.achievements?.length]);

  const postFeed = usePostFeed();
  const deleteFeedItem = useDeleteFeedItem();
  const pinnedIds = profileUser?.pinnedPostIds ?? [];
  const [compactTop, setCompactTop] = useState(false);
  const compactTopRef = useRef(false);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<ProfileTabId>("postagens");
  const [feedTypeFilter, setFeedTypeFilter] = useState<FeedTypeFilterId>("all");
  const [steamSubTab, setSteamSubTab] = useState<SteamSubTabId>("resumo");
  const [steamGamesSearch, setSteamGamesSearch] = useState("");
  const [steamConquistasGameSearch, setSteamConquistasGameSearch] = useState("");
  const [steamConquistasAchievementSearch, setSteamConquistasAchievementSearch] = useState("");
  const [steamConquistasSelectedGameId, setSteamConquistasSelectedGameId] = useState<string | null>(null);
  const [steamConquistasDropdownOpen, setSteamConquistasDropdownOpen] = useState(false);

  const [content, setContent] = useState("");
  const [allowComments, setAllowComments] = useState(true);
  const [allowReactions, setAllowReactions] = useState(true);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);

  useEffect(() => {
    const listEl = listScrollRef.current;
    if (!listEl) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrolled = listEl.scrollTop ?? 0;
          const shouldBeCompact = scrolled > 50;
          const shouldExpand = scrolled < 30;
          if (shouldBeCompact && !compactTopRef.current) {
            compactTopRef.current = true;
            setCompactTop(true);
          } else if (shouldExpand && compactTopRef.current) {
            compactTopRef.current = false;
            setCompactTop(false);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    listEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => listEl.removeEventListener("scroll", handleScroll);
  }, [profileUser]);

  const pinMutation = useMutation({
    mutationFn: updatePinnedPosts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meKey });
      queryClient.invalidateQueries({ queryKey: MY_FEED_QUERY_KEY });
      refetchUser();
    },
  });

  const handlePin = (itemId: string) => {
    if (pinnedIds.length >= MAX_PINNED) {
      toast.error(`Você pode fixar no máximo ${MAX_PINNED} postagens.`);
      return;
    }
    if (pinnedIds.includes(itemId)) return;
    pinMutation.mutate([...pinnedIds, itemId].slice(0, MAX_PINNED), {
      onSuccess: () => toast.success("Postagem fixada no perfil!"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao fixar"),
    });
  };

  const handleUnpin = (itemId: string) => {
    pinMutation.mutate(pinnedIds.filter((id) => id !== itemId), {
      onSuccess: () => toast.success("Postagem desfixada."),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao desfixar"),
    });
  };

  const handleSubmitPost = async () => {
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
            toast.error(err instanceof Error ? err.message : "Falha ao enviar.");
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
      if (pinnedIds.includes(postId)) {
        await pinMutation.mutateAsync(pinnedIds.filter((id) => id !== postId));
      }
      toast.success("Postagem excluída!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao excluir postagem.";
      toast.error(message);
    }
  };

  if (!isApiConfigured()) {
    return (
      <MainLayout sidebarLeft={<SidebarLeft />} sidebarRight={<SidebarRight />}>
        <div className="p-4 tf-card">
          <p className="text-muted-foreground text-sm">Configure a API para acessar seu perfil.</p>
        </div>
      </MainLayout>
    );
  }

  if (isOwnProfile && !currentUser) {
    return (
      <MainLayout sidebarLeft={<SidebarLeft />} sidebarRight={<SidebarRight />}>
        <div className="p-4 tf-card">
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </MainLayout>
    );
  }
  if (!isOwnProfile && (profileUserId == null || profileUserFromApi === undefined)) {
    return (
      <MainLayout sidebarLeft={<SidebarLeft />} sidebarRight={<SidebarRight />}>
        <div className="p-4 tf-card">
          <p className="text-muted-foreground text-sm">Carregando perfil...</p>
        </div>
      </MainLayout>
    );
  }
  if (!isOwnProfile && profileUserFromApi === null) {
    return (
      <MainLayout sidebarLeft={<SidebarLeft />} sidebarRight={<SidebarRight />}>
        <div className="p-4 tf-card">
          <p className="text-muted-foreground text-sm">Usuário não encontrado.</p>
        </div>
      </MainLayout>
    );
  }

  if (!profileUser) {
    return (
      <MainLayout sidebarLeft={<SidebarLeft />} sidebarRight={<SidebarRight />}>
        <div className="p-4 tf-card">
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </MainLayout>
    );
  }

  const user = profileUser;
  const gradientClass = user.team === "RED" ? "team-gradient-red" : "team-gradient-blu";
  const borderClass = user.team === "RED" ? "border-team-red bg-team-red/10" : "border-team-blu bg-team-blu/10";
  const rank = getRank(user.level);

  const filteredFeed =
    feedTypeFilter === "all"
      ? feed
      : feed.filter((item) => {
          if (feedTypeFilter === "scrap") return item.type === "scrap";
          if (feedTypeFilter === "post") return item.type === "post" || item.type === "achievement";
          if (feedTypeFilter === "community") return item.type === "community";
          return true;
        });

  return (
    <MainLayout sidebarLeft={<SidebarLeft />} sidebarRight={<SidebarRight />}>
      <div className="flex flex-col min-h-0 h-full overflow-hidden">
        {/* Profile card: full or compact on scroll */}
        <div
          className={`flex-shrink-0 tf-card overflow-hidden transition-all duration-200 ${
            compactTop ? "mb-2" : "mb-4"
          }`}
        >
          {compactTop ? (
            <div className={`${gradientClass} px-3 py-2 flex items-center gap-3`}>
              <div
                className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg flex-shrink-0 overflow-hidden ${borderClass}`}
              >
                {user.avatar ? (
                  <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  CLASS_EMOJIS[user.mainClass]
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-heading text-sm text-primary-foreground truncate block">
                  {user.name}
                </span>
                <span className="text-xs text-primary-foreground/80 truncate block">@{user.nickname}</span>
              </div>
              {isOwnProfile && (
                <Link
                  to="/settings"
                  className="flex-shrink-0 text-[10px] font-heading uppercase tracking-wider text-primary-foreground/90 hover:text-primary-foreground"
                >
                  Configurações
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className={`${gradientClass} h-24 sm:h-28`} />
              <div className="px-4 pb-4 -mt-12 sm:-mt-14 relative">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  <div
                    className={`w-24 h-24 sm:w-28 sm:h-28 rounded-xl border-4 border-card flex items-center justify-center text-4xl sm:text-5xl flex-shrink-0 overflow-hidden ${borderClass}`}
                  >
                    {user.avatar ? (
                      <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      CLASS_EMOJIS[user.mainClass]
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <h1 className="font-heading text-xl sm:text-2xl text-card-foreground leading-tight">
                      {user.name}
                    </h1>
                    <p className="text-sm text-muted-foreground">@{user.nickname}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-bold text-accent">{rank}</span>
                      <span>•</span>
                      <span>Team {user.team}</span>
                      <span>•</span>
                      <span>LVL {user.level}</span>
                      <span>•</span>
                      <span>{user.mainClass}</span>
                    </div>
                    {user.steamProfileUrl && (
                      <a
                        href={user.steamProfileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline inline-block mt-1"
                      >
                        Steam →
                      </a>
                    )}
                    {isOwnProfile && (
                      <div className="pt-2">
                        <Link
                          to="/settings"
                          className="inline-block px-3 py-1.5 rounded border border-border bg-muted/50 text-xs font-heading uppercase tracking-wider hover:bg-muted transition-colors"
                        >
                          Configurações
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex flex-wrap gap-1 p-1 bg-muted/50 rounded border border-border mb-3">
          {PROFILE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 min-w-0 py-2 px-3 rounded font-heading text-[10px] uppercase tracking-wider transition-colors
                ${activeTab === t.id ? "bg-accent text-accent-foreground tf-shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div ref={listScrollRef} className="list-scroll flex-1 min-h-0 pr-1 flex flex-col">
          {activeTab === "postagens" && (
            <>
              {isOwnProfile && (
                <div
                  className={`flex-shrink-0 tf-card transition-all duration-200 mb-4 ${
                    compactTop ? "p-2" : "p-4 space-y-3"
                  }`}
                >
                  <h3 className="font-heading text-xs text-muted-foreground uppercase tracking-widest">
                    📡 Nova publicação
                  </h3>
                  <div
                    className={`transition-all duration-200 overflow-hidden ${
                      compactTop ? "max-h-0 opacity-0" : "max-h-[1000px] opacity-100"
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
                          onClick={handleSubmitPost}
                          disabled={(!content.trim() && attachmentFiles.length === 0) || postFeed.isPending}
                        >
                          🔥 Enviar Intel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="sticky top-0 z-10 flex-shrink-0 flex flex-wrap gap-1 py-2 -mx-1 px-1 mb-3 bg-background/95 backdrop-blur-sm border-b border-border/50">
                {FEED_TYPE_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFeedTypeFilter(f.id)}
                    className={`px-2.5 py-1 rounded text-[10px] font-heading uppercase tracking-wider
                      ${feedTypeFilter === f.id ? "bg-accent/20 text-accent" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {feedLoading ? (
                <p className="text-muted-foreground text-sm">Carregando...</p>
              ) : filteredFeed.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {isOwnProfile ? "Você ainda não publicou nada. " : "Nenhuma postagem. "}
                  {isOwnProfile && (
                    <Link to="/" className="text-accent hover:underline">Ir para o feed →</Link>
                  )}
                </p>
              ) : (
                <div className="space-y-4">
                  {filteredFeed.map((item) => (
                    <div key={item.id} className="space-y-1">
                      {isOwnProfile && (
                        <div className="flex items-center justify-end gap-2 px-1">
                          {item.pinnedOrder != null ? (
                            <button
                              type="button"
                              onClick={() => handleUnpin(item.id)}
                              disabled={pinMutation.isPending}
                              className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-50"
                            >
                              Desfixar
                            </button>
                          ) : pinnedIds.length < MAX_PINNED ? (
                            <button
                              type="button"
                              onClick={() => handlePin(item.id)}
                              disabled={pinMutation.isPending}
                              className="text-[10px] font-heading uppercase tracking-wider text-accent hover:underline disabled:opacity-50"
                            >
                              Fixar no perfil
                            </button>
                          ) : null}
                        </div>
                      )}
                      <FeedCard
                        item={item}
                        onReactionChange={() => {
                          queryClient.invalidateQueries({ queryKey: MY_FEED_QUERY_KEY });
                          if (profileUserId) queryClient.invalidateQueries({ queryKey: ["feed", profileUserId] });
                        }}
                        onDelete={isOwnProfile ? () => handleDeletePost(item.id) : undefined}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "midia" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {profileMedia.length === 0 ? (
                <p className="text-muted-foreground text-sm col-span-full">Nenhuma mídia.</p>
              ) : (
                profileMedia.map((m, idx) => {
                  const linkTo = m.feedItemId ? `/post/${m.feedItemId}` : m.scrapId ? `/post/${m.scrapId}` : null;
                  const isImage = m.type === "image";
                  const content = isImage ? (
                    <img src={m.url} alt="" className="w-full aspect-square object-cover rounded border border-border" />
                  ) : (
                    <div className="w-full aspect-square rounded border border-border bg-muted flex items-center justify-center text-muted-foreground text-xs">
                      {m.type === "video" ? "Vídeo" : m.type === "audio" ? "Áudio" : "Arquivo"}
                    </div>
                  );
                  return linkTo ? (
                    <Link key={`${m.url}-${idx}`} to={linkTo} className="block">
                      {content}
                    </Link>
                  ) : (
                    <a key={`${m.url}-${idx}`} href={m.url} target="_blank" rel="noopener noreferrer">
                      {content}
                    </a>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "amigos" && (
            <div className="space-y-4">
              {!isOwnProfile && (friendsInCommon.length > 0 || profileFriends.length > 0) && (
                <div>
                  <h3 className="font-heading text-xs text-muted-foreground uppercase tracking-widest mb-2">
                    Amigos em comum {friendsInCommon.length > 0 && `(${friendsInCommon.length})`}
                  </h3>
                  {friendsInCommon.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum amigo em comum.</p>
                  ) : (
                    <ul className="space-y-2 mb-4">
                      {friendsInCommon.map((friend) => (
                        <li key={friend.id}>
                          <Link
                            to={`/profile/${friend.id}`}
                            className="flex items-center gap-3 p-3 rounded-lg border border-border bg-accent/10 hover:bg-accent/20 transition-colors border-accent/30"
                          >
                            <div className="w-10 h-10 rounded-full border-2 border-border overflow-hidden flex items-center justify-center text-lg bg-muted">
                              {friend.avatar ? (
                                <img src={friend.avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="opacity-70">👤</span>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{friend.name}</p>
                              <p className="text-xs text-muted-foreground">@{friend.nickname}</p>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div>
                {!isOwnProfile && profileFriends.length > 0 && (
                  <h3 className="font-heading text-xs text-muted-foreground uppercase tracking-widest mb-2">
                    Amigos
                  </h3>
                )}
                {profileFriends.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum amigo.</p>
                ) : (
                  <ul className="space-y-2">
                    {profileFriends.map((friend) => (
                      <li key={friend.id}>
                        <Link
                          to={`/profile/${friend.id}`}
                          className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-full border-2 border-border overflow-hidden flex items-center justify-center text-lg bg-muted">
                            {friend.avatar ? (
                              <img src={friend.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="opacity-70">👤</span>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{friend.name}</p>
                            <p className="text-xs text-muted-foreground">@{friend.nickname}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {activeTab === "steam" && (
            <div className={`flex flex-col min-h-0 ${steamSubTab === "resumo" ? "" : "flex-1"}`}>
              {!user.steamId64 ? (
                <p className="text-muted-foreground text-sm">Steam não vinculada.</p>
              ) : (
                <>
                  <div className="flex-shrink-0 flex flex-wrap gap-1 p-1 bg-muted/30 rounded border border-border mb-3">
                    {STEAM_SUB_TABS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSteamSubTab(t.id)}
                        className={`flex-1 min-w-0 py-2 px-2 rounded font-heading text-[10px] uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-1
                          ${steamSubTab === t.id ? "bg-accent text-accent-foreground tf-shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                      >
                        <span>{t.icon}</span>
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>

                  {steamSubTab === "resumo" && (
                    <section className="space-y-4 flex-shrink-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground">Conta vinculada</span>
                        {user.steamProfileUrl && (
                          <a
                            href={user.steamProfileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-accent hover:underline"
                          >
                            Ver perfil na Steam →
                          </a>
                        )}
                      </div>
                      {user.steamTotalPlaytimeMinutes != null && user.steamTotalPlaytimeMinutes > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Total de horas jogadas: <strong className="text-foreground">{Math.round(user.steamTotalPlaytimeMinutes / 60)}h</strong>
                        </p>
                      )}
                      {(() => {
                        const recentGames = (user.steamGames ?? [])
                          .filter((g) => (g.playtime2WeeksMinutes ?? 0) > 0)
                          .slice()
                          .sort((a, b) => (b.playtime2WeeksMinutes ?? 0) - (a.playtime2WeeksMinutes ?? 0))
                          .slice(0, 5);
                        if (recentGames.length === 0) return null;
                        return (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Atividade recente</p>
                            <ul className="space-y-2">
                              {recentGames.map((g) => (
                                <li
                                  key={g.appId}
                                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20"
                                >
                                  {g.iconUrl ? (
                                    <img src={g.iconUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                                  ) : (
                                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0 text-lg">🎮</div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{g.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {Math.round((g.playtime2WeeksMinutes ?? 0) / 60)}h nas últimas 2 semanas
                                    </p>
                                  </div>
                                  <span className="text-sm font-medium shrink-0">
                                    {Math.round((g.playtime2WeeksMinutes ?? 0) / 60)}h
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })()}
                    </section>
                  )}

                  {steamSubTab === "conquistas" && (
                    <section className="flex flex-col min-h-0 flex-1">
                      <div className="flex-shrink-0 mb-3">
                        <h3 className="font-heading text-xs text-muted-foreground uppercase tracking-widest">
                          Conquistas
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Conquistas desbloqueadas na Steam.
                        </p>
                      </div>
                      {!(user.achievements?.length) ? (
                        <p className="text-sm text-muted-foreground flex-shrink-0">
                          Nenhuma conquista importada. Sincronize a Steam nas configurações.
                        </p>
                      ) : (
                        <>
                          {(() => {
                            const gamesWithAchievements = (user.steamGames ?? [])
                              .filter((g) => (steamAchievementsByGame[String(g.appId)]?.length ?? 0) > 0)
                              .sort((a, b) => {
                                const aCount = steamAchievementsByGame[String(a.appId)]?.length ?? 0;
                                const bCount = steamAchievementsByGame[String(b.appId)]?.length ?? 0;
                                return bCount - aCount;
                              });
                            const filteredGamesWithAchievements = gamesWithAchievements.filter((g) =>
                              g.name.toLowerCase().includes(steamConquistasGameSearch.toLowerCase())
                            );
                            const baseFilteredAchievements = steamConquistasSelectedGameId
                              ? (steamAchievementsByGame[steamConquistasSelectedGameId] ?? [])
                              : user.achievements ?? [];
                            const filteredAchievements = steamConquistasAchievementSearch.trim()
                              ? baseFilteredAchievements.filter(
                                  (ach) =>
                                    ach.title.toLowerCase().includes(steamConquistasAchievementSearch.trim().toLowerCase()) ||
                                    ach.description.toLowerCase().includes(steamConquistasAchievementSearch.trim().toLowerCase())
                                )
                              : baseFilteredAchievements;
                            return (
                              <>
                                {gamesWithAchievements.length >= 1 && (
                                  <div className="flex-shrink-0 mb-3">
                                    <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
                                      Filtrar por jogo
                                    </label>
                                    <div className="relative flex gap-2">
                                      <div className="flex-1 relative">
                                        <input
                                          type="text"
                                          value={steamConquistasGameSearch}
                                          onChange={(e) => {
                                            setSteamConquistasGameSearch(e.target.value);
                                            setSteamConquistasDropdownOpen(true);
                                            if (steamConquistasSelectedGameId) {
                                              const selected = gamesWithAchievements.find((g) => String(g.appId) === steamConquistasSelectedGameId);
                                              if (selected && e.target.value !== selected.name) {
                                                setSteamConquistasSelectedGameId(null);
                                              }
                                            }
                                          }}
                                          onFocus={() => setSteamConquistasDropdownOpen(true)}
                                          onBlur={() => setTimeout(() => setSteamConquistasDropdownOpen(false), 200)}
                                          placeholder="Buscar jogo ou selecionar..."
                                          className="w-full rounded border border-border bg-background px-3 py-2 pr-8 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                                        />
                                        {steamConquistasGameSearch && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSteamConquistasGameSearch("");
                                              setSteamConquistasSelectedGameId(null);
                                            }}
                                            className="absolute right-8 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded transition-colors"
                                            title="Limpar busca"
                                          >
                                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                                          </button>
                                        )}
                                        <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none transition-transform ${steamConquistasDropdownOpen ? "rotate-180" : ""}`} />
                                        {steamConquistasDropdownOpen && (
                                          <div
                                            className="absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-md border border-border bg-background shadow-lg"
                                            onMouseDown={(e) => e.preventDefault()}
                                          >
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setSteamConquistasSelectedGameId(null);
                                                setSteamConquistasGameSearch("");
                                                setSteamConquistasDropdownOpen(false);
                                              }}
                                              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors ${!steamConquistasSelectedGameId ? "bg-accent/50" : ""}`}
                                            >
                                              Todos os jogos ({(user.achievements ?? []).length} conquistas)
                                            </button>
                                            {filteredGamesWithAchievements.length === 0 ? (
                                              <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum jogo encontrado</div>
                                            ) : (
                                              filteredGamesWithAchievements.map((game) => {
                                                const count = steamAchievementsByGame[String(game.appId)]?.length ?? 0;
                                                const isSelected = steamConquistasSelectedGameId === String(game.appId);
                                                return (
                                                  <button
                                                    key={game.appId}
                                                    type="button"
                                                    onClick={() => {
                                                      setSteamConquistasSelectedGameId(String(game.appId));
                                                      setSteamConquistasGameSearch(game.name);
                                                      setSteamConquistasDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors ${isSelected ? "bg-accent/50" : ""}`}
                                                  >
                                                    {game.name} ({count} conquistas)
                                                  </button>
                                                );
                                              })
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      {steamConquistasSelectedGameId && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSteamConquistasSelectedGameId(null);
                                            setSteamConquistasGameSearch("");
                                          }}
                                          className="px-3 py-2 rounded border border-border bg-muted/50 text-sm font-heading uppercase tracking-wider hover:bg-muted transition-colors whitespace-nowrap"
                                          title="Limpar filtro"
                                        >
                                          Limpar filtro
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                                <div className="flex-shrink-0 mb-3">
                                  <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
                                    Buscar conquistas
                                  </label>
                                  <input
                                    type="text"
                                    value={steamConquistasAchievementSearch}
                                    onChange={(e) => setSteamConquistasAchievementSearch(e.target.value)}
                                    placeholder="Buscar por nome ou descrição..."
                                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                                  />
                                </div>
                                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 list-scroll">
                                  {filteredAchievements.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                      {steamConquistasAchievementSearch || steamConquistasSelectedGameId
                                        ? "Nenhuma conquista encontrada com os filtros aplicados."
                                        : "Nenhuma conquista disponível."}
                                    </p>
                                  ) : (
                                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pb-2">
                                      {filteredAchievements.map((ach) => (
                                        <div
                                          key={ach.id}
                                          className="flex flex-col items-center gap-1 p-2 rounded border-2 border-border bg-muted/10"
                                          title={ach.description}
                                        >
                                          <div className="w-10 h-10 rounded bg-muted border border-border flex items-center justify-center overflow-hidden">
                                            {ach.icon.startsWith("http") ? (
                                              <img src={ach.icon} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                              <span className="text-lg">{ach.icon}</span>
                                            )}
                                          </div>
                                          <span className="text-[10px] text-center line-clamp-2 leading-tight">{ach.title}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </>
                      )}
                    </section>
                  )}

                  {steamSubTab === "jogos" && (
                    <section className="flex flex-col min-h-0 flex-1">
                      <div className="flex-shrink-0 mb-3">
                        <h3 className="font-heading text-xs text-muted-foreground uppercase tracking-widest">
                          Meus jogos
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Biblioteca Steam ordenada por tempo jogado. Progresso de conquistas por jogo.
                        </p>
                      </div>
                      {!(user.steamGames?.length) ? (
                        <p className="text-sm text-muted-foreground flex-shrink-0">
                          Nenhum jogo na biblioteca. Sincronize a Steam nas configurações.
                        </p>
                      ) : (
                        <>
                          <div className="flex-shrink-0 mb-3">
                            <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
                              Buscar jogos
                            </label>
                            <input
                              type="text"
                              value={steamGamesSearch}
                              onChange={(e) => setSteamGamesSearch(e.target.value)}
                              placeholder="Buscar por nome do jogo..."
                              className="w-full rounded border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                            />
                          </div>
                          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 list-scroll">
                            <ul className="space-y-2 pb-2">
                              {(user.steamGames ?? [])
                                .slice()
                                .sort((a, b) => b.playtimeMinutes - a.playtimeMinutes)
                                .filter((g) =>
                                  !steamGamesSearch.trim() ||
                                  g.name.toLowerCase().includes(steamGamesSearch.trim().toLowerCase())
                                )
                                .map((g) => {
                                  const unlockedCount = steamAchievementsByGame[String(g.appId)]?.length ?? 0;
                                  const hasAchievements = unlockedCount > 0;
                                  return (
                                    <li
                                      key={g.appId}
                                      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                                    >
                                      {g.iconUrl ? (
                                        <img src={g.iconUrl} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                                      ) : (
                                        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0 text-xl">🎮</div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{g.name}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          {Math.round(g.playtimeMinutes / 60)}h jogadas
                                          {hasAchievements && (
                                            <span className="ml-2">
                                              • {unlockedCount} {unlockedCount === 1 ? "conquista" : "conquistas"} desbloqueadas
                                            </span>
                                          )}
                                        </p>
                                      </div>
                                      {hasAchievements && (
                                        <div className="shrink-0 text-right">
                                          <div className="text-xs font-heading uppercase tracking-wider text-muted-foreground">
                                            Conquistas
                                          </div>
                                          <div className="text-sm font-medium">{unlockedCount}</div>
                                        </div>
                                      )}
                                    </li>
                                  );
                                })}
                            </ul>
                            {steamGamesSearch.trim() &&
                              (user.steamGames ?? []).filter((g) =>
                                g.name.toLowerCase().includes(steamGamesSearch.trim().toLowerCase())
                              ).length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-6">
                                  Nenhum jogo encontrado com &quot;{steamGamesSearch.trim()}&quot;.
                                </p>
                              )}
                          </div>
                        </>
                      )}
                    </section>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "comunidades" && (
            <div className="space-y-2">
              {profileCommunities.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhuma comunidade.</p>
              ) : (
                profileCommunities.map((c) => (
                  <Link
                    key={c.id}
                    to={`/communities/${c.id}`}
                    className="block p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {"memberCount" in c && typeof (c as { memberCount?: number }).memberCount === "number"
                        ? `${(c as { memberCount: number }).memberCount} membros`
                        : "members" in c && typeof (c as { members?: number }).members === "number"
                          ? `${(c as { members: number }).members} membros`
                          : ""}
                    </p>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
