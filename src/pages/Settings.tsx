import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { SidebarLeft } from "@/components/layout/SidebarLeft";
import { SidebarRight } from "@/components/layout/SidebarRight";
import { useUser, useMeQueryKey } from "@/hooks/useUser";
import { getSteamAuthRedirectUrl, linkSteam, unlinkSteam, syncSteam } from "@/api/steam";
import { updatePinnedAchievements, updateMe } from "@/api/user";
import { uploadFileToR2 } from "@/api/upload";
import { isApiConfigured } from "@/api/client";
import { ChevronDown, X } from "lucide-react";

const TABS = [
  { id: "steam" as const, label: "Steam", icon: "🎮" },
  { id: "atividade" as const, label: "Atividade recente", icon: "📅" },
  { id: "jogos" as const, label: "Meus jogos", icon: "📋" },
  { id: "conquistas" as const, label: "Conquistas em destaque", icon: "🏆" },
];
type TabId = "steam" | "atividade" | "jogos" | "conquistas";

export default function Settings() {
  const { user, refetch } = useUser();
  const queryClient = useQueryClient();
  const meKey = useMeQueryKey();
  const [activeTab, setActiveTab] = useState<TabId>("steam");
  const [steamInput, setSteamInput] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [unlinkLoading, setUnlinkLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [pinnedSaving, setPinnedSaving] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [gameSearch, setGameSearch] = useState("");
  const [achievementSearch, setAchievementSearch] = useState("");
  const [gameDropdownOpen, setGameDropdownOpen] = useState(false);
  const [myGamesSearch, setMyGamesSearch] = useState("");
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const isUserEditingRef = useRef(false);

  const achievements = user?.achievements ?? [];
  const serverPinnedIds = user?.pinnedAchievementIds ?? [];

  useEffect(() => {
    if (!isUserEditingRef.current && serverPinnedIds) {
      setPinnedIds(serverPinnedIds);
    }
  }, [serverPinnedIds.join(",")]);

  const handleToggleAchievement = useCallback((achievementId: string, currentlyPinned: boolean) => {
    if (pinnedSaving) return;
    isUserEditingRef.current = true;
    setPinnedIds((prev) => {
      if (currentlyPinned) {
        return prev.filter((id) => id !== achievementId);
      } else {
        if (prev.length >= 8) return prev;
        return [...prev, achievementId];
      }
    });
  }, [pinnedSaving]);

  const hasSteam = Boolean(user.steamId64);
  const totalHours = user.steamTotalPlaytimeMinutes != null
    ? Math.round(user.steamTotalPlaytimeMinutes / 60)
    : 0;
  const topGames = (user.steamGames ?? [])
    .slice()
    .sort((a, b) => b.playtimeMinutes - a.playtimeMinutes)
    .slice(0, 5);

  // Group achievements by game (appId is the first part of the id: "appId-apiName")
  const achievementsByGame = achievements.reduce((acc, ach) => {
    const firstDashIndex = ach.id.indexOf("-");
    const appId = firstDashIndex > 0 ? ach.id.substring(0, firstDashIndex) : ach.id;
    if (!acc[appId]) acc[appId] = [];
    acc[appId].push(ach);
    return acc;
  }, {} as Record<string, typeof achievements>);

  // Get games that have achievements
  const gamesWithAchievements = (user.steamGames ?? [])
    .filter((game) => achievementsByGame[String(game.appId)]?.length > 0)
    .sort((a, b) => {
      const aCount = achievementsByGame[String(a.appId)]?.length ?? 0;
      const bCount = achievementsByGame[String(b.appId)]?.length ?? 0;
      return bCount - aCount; // Sort by achievement count descending
    });

  // Filter games based on search
  const filteredGamesWithAchievements = gamesWithAchievements.filter((game) =>
    game.name.toLowerCase().includes(gameSearch.toLowerCase())
  );

  // Filter achievements based on selected game and search
  const baseFilteredAchievements = selectedGameId
    ? achievementsByGame[selectedGameId] ?? []
    : achievements;
  
  const filteredAchievements = achievementSearch
    ? baseFilteredAchievements.filter((ach) =>
        ach.title.toLowerCase().includes(achievementSearch.toLowerCase()) ||
        ach.description.toLowerCase().includes(achievementSearch.toLowerCase())
      )
    : baseFilteredAchievements;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const steamLink = params.get("steam_link");
    const msg = params.get("message");
    if (steamLink === "ok") {
      setMessage("Conta Steam vinculada com sucesso!");
      window.history.replaceState({}, "", window.location.pathname);
      queryClient.invalidateQueries({ queryKey: meKey }).then(() => refetch());
    } else if (steamLink === "error" && msg) {
      setLinkError(decodeURIComponent(msg));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [queryClient, meKey, refetch]);

  const handleLinkWithSteam = () => {
    setLinkError(null);
    try {
      const url = getSteamAuthRedirectUrl();
      window.location.href = url;
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "Erro ao iniciar vinculação");
    }
  };

  const handleLinkWithId = async () => {
    const input = steamInput.trim();
    if (!input) {
      setLinkError("Informe o Steam ID ou a URL do perfil.");
      return;
    }
    setLinkError(null);
    setLinkLoading(true);
    try {
      const isUrl = /steamcommunity\.com\/id\//i.test(input) || /steamcommunity\.com\/profiles\//i.test(input);
      if (isUrl) {
        await linkSteam({ vanityUrl: input });
      } else {
        await linkSteam({ steamId64: input });
      }
      await queryClient.invalidateQueries({ queryKey: meKey });
      setSteamInput("");
      setMessage("Conta Steam vinculada!");
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "Erro ao vincular");
    } finally {
      setLinkLoading(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm("Desvincular sua conta Steam? Seus dados de jogos e conquistas serão removidos do perfil.")) return;
    setUnlinkLoading(true);
    setLinkError(null);
    try {
      await unlinkSteam();
      await queryClient.invalidateQueries({ queryKey: meKey });
      setMessage("Conta Steam desvinculada.");
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "Erro ao desvincular");
    } finally {
      setUnlinkLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncLoading(true);
    setLinkError(null);
    try {
      await syncSteam();
      await queryClient.invalidateQueries({ queryKey: meKey });
      setMessage("Dados Steam atualizados.");
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "Erro ao sincronizar");
    } finally {
      setSyncLoading(false);
    }
  };

  if (!isApiConfigured()) {
    return (
      <MainLayout sidebarLeft={<SidebarLeft />} sidebarRight={<SidebarRight />}>
        <div className="p-4 tf-card">
          <p className="text-muted-foreground text-sm">Configure a API para acessar as configurações.</p>
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return (
      <MainLayout sidebarLeft={<SidebarLeft />} sidebarRight={<SidebarRight />}>
        <div className="p-4 tf-card">
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout sidebarLeft={<SidebarLeft />} sidebarRight={<SidebarRight />}>
      <div className="flex flex-col min-h-0 h-full overflow-hidden">
        <div className="flex-shrink-0 flex items-center justify-between gap-3 mb-4">
          <h1 className="font-heading text-sm text-muted-foreground uppercase tracking-widest">
            Conta e integrações
          </h1>
          <Link
            to="/"
            className="text-[10px] font-heading uppercase tracking-wider text-accent hover:text-tf-yellow-light transition-colors"
          >
            ← Voltar ao Feed
          </Link>
        </div>

        {message && (
          <div className="flex-shrink-0 mb-3 p-3 rounded bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400 text-sm">
            {message}
          </div>
        )}
        {linkError && (
          <div className="flex-shrink-0 mb-3 p-3 rounded bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            {linkError}
          </div>
        )}

        {/* Foto de perfil */}
        <section className="flex-shrink-0 tf-card p-4 mb-3">
          <h2 className="font-heading text-xs text-muted-foreground uppercase tracking-widest mb-3">
            Foto de perfil
          </h2>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg border-2 border-border overflow-hidden bg-muted flex items-center justify-center shrink-0 text-2xl">
              {user.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="opacity-70">👤</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground mb-2">
                Use uma imagem JPEG, PNG, GIF ou WebP (máx. 10 MB).
              </p>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setAvatarError(null);
                  setAvatarLoading(true);
                  try {
                    const { url } = await uploadFileToR2(file, "avatar");
                    await updateMe({ avatar: url });
                    await queryClient.invalidateQueries({ queryKey: meKey });
                    refetch();
                  } catch (err) {
                    setAvatarError(err instanceof Error ? err.message : "Falha ao enviar foto");
                  } finally {
                    setAvatarLoading(false);
                  }
                }}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={avatarLoading}
                  onClick={() => avatarInputRef.current?.click()}
                  className="px-3 py-2 rounded border border-border bg-muted/50 text-sm font-heading uppercase tracking-wider hover:bg-muted disabled:opacity-50"
                >
                  {avatarLoading ? "Enviando…" : "Alterar foto"}
                </button>
                {user.avatar && (
                  <button
                    type="button"
                    disabled={avatarLoading}
                    onClick={async () => {
                      setAvatarError(null);
                      setAvatarLoading(true);
                      try {
                        await updateMe({ avatar: null });
                        await queryClient.invalidateQueries({ queryKey: meKey });
                        refetch();
                      } catch (err) {
                        setAvatarError(err instanceof Error ? err.message : "Falha ao remover foto");
                      } finally {
                        setAvatarLoading(false);
                      }
                    }}
                    className="px-3 py-2 rounded border border-border bg-muted/50 text-sm font-heading uppercase tracking-wider hover:bg-muted disabled:opacity-50 text-muted-foreground"
                  >
                    Remover foto
                  </button>
                )}
              </div>
              {avatarError && (
                <p className="text-sm text-destructive mt-2">{avatarError}</p>
              )}
            </div>
          </div>
        </section>

        <div className="flex-shrink-0 flex flex-wrap gap-1 p-1 bg-muted/50 rounded border border-border mb-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 min-w-0 py-2 px-3 rounded font-heading text-[10px] uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-1.5
                ${activeTab === t.id
                  ? "bg-accent text-accent-foreground tf-shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className={`pr-1 flex-1 min-h-0 overflow-hidden ${activeTab === "conquistas" || activeTab === "jogos" || activeTab === "atividade" ? "flex flex-col" : "space-y-6 list-scroll"}`}>
          {activeTab === "steam" && (
          <section className="tf-card p-4 space-y-4">
            <h2 className="font-heading text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              Steam
            </h2>
            {hasSteam ? (
              <>
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
                {totalHours > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Total de horas jogadas: <strong className="text-foreground">{totalHours}h</strong>
                  </p>
                )}
                {topGames.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Top jogos</p>
                    <ul className="space-y-1 text-sm">
                      {topGames.map((g) => (
                        <li key={g.appId} className="flex items-center gap-2">
                          {g.iconUrl && (
                            <img src={g.iconUrl} alt="" className="w-6 h-6 rounded object-cover" />
                          )}
                          <span className="truncate">{g.name}</span>
                          <span className="text-muted-foreground text-xs shrink-0">
                            {Math.round(g.playtimeMinutes / 60)}h
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleSync}
                    disabled={syncLoading}
                    className="px-3 py-2 rounded border border-border bg-muted/50 text-sm font-heading uppercase tracking-wider hover:bg-muted disabled:opacity-50"
                  >
                    {syncLoading ? "Sincronizando…" : "Sincronizar agora"}
                  </button>
                  <button
                    type="button"
                    onClick={handleUnlink}
                    disabled={unlinkLoading}
                    className="px-3 py-2 rounded border border-destructive/50 text-destructive text-sm font-heading uppercase tracking-wider hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {unlinkLoading ? "…" : "Desvincular Steam"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Vincule sua conta Steam para importar conquistas, jogos e horas jogadas para o perfil.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleLinkWithSteam}
                    className="px-4 py-2 rounded bg-[#1b2838] text-white text-sm font-heading uppercase tracking-wider hover:brightness-110"
                  >
                    Vincular com login Steam
                  </button>
                </div>
                <div className="pt-2 border-t border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                    Ou informe Steam ID / URL do perfil
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={steamInput}
                      onChange={(e) => setSteamInput(e.target.value)}
                      placeholder="Steam ID 64 ou URL (ex: steamcommunity.com/id/meunick)"
                      className="flex-1 min-w-0 rounded border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleLinkWithId}
                      disabled={linkLoading}
                      className="px-3 py-2 rounded border border-border bg-muted/50 text-sm font-heading uppercase tracking-wider hover:bg-muted disabled:opacity-50"
                    >
                      {linkLoading ? "…" : "Vincular"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
          )}

          {activeTab === "atividade" && (
            <section className="tf-card p-4 flex flex-col overflow-hidden flex-1 min-h-0">
              <div className="flex-shrink-0 mb-3">
                <h2 className="font-heading text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  Atividade recente
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Jogos jogados nas últimas 2 semanas, ordenados por tempo jogado.
                </p>
              </div>
              {!hasSteam || !user.steamGames?.length ? (
                <p className="text-sm text-muted-foreground flex-shrink-0">
                  Vincule a Steam e sincronize para ver sua atividade recente.
                </p>
              ) : (() => {
                const recentGames = (user.steamGames ?? [])
                  .filter((g) => (g.playtime2WeeksMinutes ?? 0) > 0)
                  .slice()
                  .sort((a, b) => (b.playtime2WeeksMinutes ?? 0) - (a.playtime2WeeksMinutes ?? 0));
                if (recentGames.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground flex-shrink-0">
                      Nenhum jogo jogado nas últimas 2 semanas. Sincronize para atualizar.
                    </p>
                  );
                }
                return (
                  <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 list-scroll">
                    <ul className="space-y-2 pb-2">
                      {recentGames.map((g) => (
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

          {activeTab === "jogos" && (
            <section className="tf-card p-4 flex flex-col overflow-hidden flex-1 min-h-0">
              <div className="flex-shrink-0 mb-3">
                <h2 className="font-heading text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  Meus jogos
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Lista de jogos da sua biblioteca Steam, ordenada por tempo jogado. Progresso de conquistas desbloqueadas por jogo.
                </p>
              </div>
              {!hasSteam || !user.steamGames?.length ? (
                <p className="text-sm text-muted-foreground flex-shrink-0">
                  Vincule a Steam e sincronize para ver sua biblioteca e o progresso de conquistas.
                </p>
              ) : (
                <>
                  <div className="flex-shrink-0 mb-3">
                    <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
                      Buscar jogos
                    </label>
                    <input
                      type="text"
                      value={myGamesSearch}
                      onChange={(e) => setMyGamesSearch(e.target.value)}
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
                          !myGamesSearch.trim() ||
                          g.name.toLowerCase().includes(myGamesSearch.trim().toLowerCase())
                        )
                        .map((g) => {
                        const unlockedCount = achievementsByGame[String(g.appId)]?.length ?? 0;
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
                    {myGamesSearch.trim() && (user.steamGames ?? []).filter((g) =>
                      g.name.toLowerCase().includes(myGamesSearch.trim().toLowerCase())
                    ).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        Nenhum jogo encontrado com &quot;{myGamesSearch.trim()}&quot;.
                      </p>
                    )}
                  </div>
                </>
              )}
            </section>
          )}

          {activeTab === "conquistas" && (
            <section className="tf-card p-4 flex flex-col overflow-hidden flex-1 min-h-0">
              <div className="flex-shrink-0 space-y-2 mb-3">
                <h2 className="font-heading text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  Conquistas em destaque no card
                </h2>
                <p className="text-sm text-muted-foreground">
                  Escolha até 8 conquistas para aparecer no seu card de perfil. Por padrão nenhuma fica em destaque.
                </p>
              </div>
              {achievements.length === 0 ? (
                <p className="text-sm text-muted-foreground flex-shrink-0">
                  Vincule a Steam e sincronize para importar suas conquistas. Depois você pode escolher quais destacar.
                </p>
              ) : (
                <>
                  {gamesWithAchievements.length > 1 && (
                    <div className="flex-shrink-0 mb-3">
                      <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
                        Filtrar por jogo
                      </label>
                      <div className="relative">
                        <div className="relative flex gap-2">
                          <div className="flex-1 relative">
                            <input
                              type="text"
                              value={gameSearch}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                setGameSearch(newValue);
                                setGameDropdownOpen(true);
                                // If user types something different from selected game, clear selection
                                if (selectedGameId) {
                                  const selectedGame = gamesWithAchievements.find(g => String(g.appId) === selectedGameId);
                                  if (selectedGame && newValue !== selectedGame.name) {
                                    setSelectedGameId(null);
                                  }
                                }
                              }}
                              onFocus={() => setGameDropdownOpen(true)}
                              onBlur={() => {
                                setTimeout(() => setGameDropdownOpen(false), 200);
                              }}
                              placeholder="Buscar jogo ou selecionar..."
                              className="w-full rounded border border-border bg-background px-3 py-2 pr-8 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                            />
                            {gameSearch && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setGameSearch("");
                                  setSelectedGameId(null);
                                }}
                                className="absolute right-8 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded transition-colors"
                                title="Limpar busca"
                              >
                                <X className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            )}
                            <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none transition-transform ${gameDropdownOpen ? "rotate-180" : ""}`} />
                            {gameDropdownOpen && (
                              <div
                                className="absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-md border border-border bg-background shadow-lg"
                                onMouseDown={(e) => e.preventDefault()}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedGameId(null);
                                    setGameSearch("");
                                    setGameDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors ${
                                    !selectedGameId ? "bg-accent/50" : ""
                                  }`}
                                >
                                  Todos os jogos ({achievements.length} conquistas)
                                </button>
                                {filteredGamesWithAchievements.length === 0 ? (
                                  <div className="px-3 py-2 text-sm text-muted-foreground">
                                    Nenhum jogo encontrado
                                  </div>
                                ) : (
                                  filteredGamesWithAchievements.map((game) => {
                                    const count = achievementsByGame[String(game.appId)]?.length ?? 0;
                                    const isSelected = selectedGameId === String(game.appId);
                                    return (
                                      <button
                                        key={game.appId}
                                        type="button"
                                        onClick={() => {
                                          setSelectedGameId(String(game.appId));
                                          setGameSearch(game.name);
                                          setGameDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors ${
                                          isSelected ? "bg-accent/50" : ""
                                        }`}
                                      >
                                        {game.name} ({count} conquistas)
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                          {selectedGameId && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedGameId(null);
                                setGameSearch("");
                              }}
                              className="px-3 py-2 rounded border border-border bg-muted/50 text-sm font-heading uppercase tracking-wider hover:bg-muted transition-colors whitespace-nowrap"
                              title="Limpar filtro"
                            >
                              Limpar filtro
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex-shrink-0 mb-3">
                    <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
                      Buscar conquistas
                    </label>
                    <input
                      type="text"
                      value={achievementSearch}
                      onChange={(e) => setAchievementSearch(e.target.value)}
                      placeholder="Buscar por nome ou descrição..."
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden pr-1 list-scroll">
                    {filteredAchievements.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        {achievementSearch || selectedGameId
                          ? "Nenhuma conquista encontrada com os filtros aplicados."
                          : "Nenhuma conquista disponível."}
                      </p>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pb-2">
                      {filteredAchievements.map((ach) => {
                        const isPinned = pinnedIds.includes(ach.id);
                        const wouldExceed = !isPinned && pinnedIds.length >= 8;
                        const disabled = wouldExceed || pinnedSaving;
                        return (
                          <div
                            key={ach.id}
                            role="checkbox"
                            tabIndex={0}
                            aria-checked={isPinned}
                            aria-disabled={disabled}
                            onClick={() => !disabled && handleToggleAchievement(ach.id, isPinned)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                if (!disabled) handleToggleAchievement(ach.id, isPinned);
                              }
                            }}
                            className={`flex flex-col items-center gap-1 p-2 rounded border-2 cursor-pointer transition-colors select-none ${
                              isPinned ? "border-accent bg-accent/10" : "border-border hover:border-muted-foreground/50"
                            } ${wouldExceed ? "opacity-60 cursor-not-allowed" : ""}`}
                          >
                            <div className="w-10 h-10 rounded bg-muted border border-border flex items-center justify-center overflow-hidden pointer-events-none">
                              {ach.icon.startsWith("http") ? (
                                <img src={ach.icon} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-lg">{ach.icon}</span>
                              )}
                            </div>
                            <span className="text-[10px] text-center line-clamp-2 leading-tight pointer-events-none">{ach.title}</span>
                          </div>
                        );
                      })}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2 pt-3 border-t border-border mt-3">
                    <span className="text-xs text-muted-foreground flex-1">
                      {pinnedIds.length} de 8 selecionadas
                      {(selectedGameId || achievementSearch) && (
                        ` • ${filteredAchievements.length} ${filteredAchievements.length === 1 ? "conquista" : "conquistas"} ${selectedGameId ? "neste jogo" : "encontradas"}`
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        isUserEditingRef.current = true;
                        setPinnedIds([]);
                      }}
                      disabled={pinnedIds.length === 0 || pinnedSaving}
                      className="px-3 py-2 rounded border border-border bg-muted/50 text-sm font-heading uppercase tracking-wider hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Limpar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setPinnedSaving(true);
                        try {
                          await updatePinnedAchievements(pinnedIds);
                          isUserEditingRef.current = false;
                          await queryClient.invalidateQueries({ queryKey: meKey });
                          setMessage("Conquistas em destaque atualizadas.");
                        } catch (e) {
                          setLinkError(e instanceof Error ? e.message : "Erro ao salvar");
                        } finally {
                          setPinnedSaving(false);
                        }
                      }}
                      disabled={pinnedSaving}
                      className="px-3 py-2 rounded bg-accent text-accent-foreground text-sm font-heading uppercase tracking-wider hover:brightness-110 disabled:opacity-50"
                    >
                      {pinnedSaving ? "Salvando…" : "Salvar destaque"}
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
