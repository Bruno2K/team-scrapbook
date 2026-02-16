import type { User, UserSteamAchievement, UserSteamGame } from "@prisma/client";

export interface UserJSON {
  id: string;
  name: string;
  nickname: string;
  team: string;
  mainClass: string;
  level: number;
  avatar: string;
  achievements: Array<{ id: string; title: string; icon: string; description: string }>;
  pinnedAchievementIds: string[];
  pinnedPostIds: string[];
  reputation: string[];
  online: boolean;
  isAiManaged?: boolean;
  steamId64?: string | null;
  steamProfileUrl?: string | null;
  steamGames?: Array<{ appId: number; name: string; iconUrl: string | null; playtimeMinutes: number; playtime2WeeksMinutes: number }>;
  steamTotalPlaytimeMinutes?: number;
  birthDate?: string | null;
  gender?: string | null;
  favoriteMap?: string | null;
  playstyle?: string | null;
  quote?: string | null;
  country?: string | null;
  bio?: string | null;
}

/** Minimal user shape needed for JSON (allows Prisma include subsets; team/mainClass can be string) */
export type UserLike = Pick<User, "id" | "name" | "nickname" | "level" | "avatar" | "online"> & {
  team: string;
  mainClass: string;
  isAiManaged?: boolean;
  steamId64?: string | null;
  steamLinkedAt?: Date | null;
  pinnedAchievementIds?: unknown;
  steamAchievements?: UserSteamAchievement[];
  steamGames?: UserSteamGame[];
};

export function userToJSON(user: UserLike): UserJSON {
  const achievements = (user.steamAchievements ?? [])
    .filter((a) => a.unlockedAt != null)
    .map((a) => ({
      id: `${a.appId}-${a.apiName}`,
      title: a.title,
      icon: a.iconUrl ?? "🏆",
      description: a.description ?? "",
    }));

  const steamGames = user.steamGames?.map((g) => ({
    appId: g.appId,
    name: g.name,
    iconUrl: g.iconUrl,
    playtimeMinutes: g.playtimeMinutes,
    playtime2WeeksMinutes: g.playtime2WeeksMinutes,
  }));

  const steamTotalPlaytimeMinutes = user.steamGames?.reduce((s, g) => s + g.playtimeMinutes, 0) ?? 0;

  const rawPinned = user.pinnedAchievementIds;
  const pinnedAchievementIds = Array.isArray(rawPinned)
    ? (rawPinned as string[]).filter((id): id is string => typeof id === "string")
    : [];

  const rawPinnedPosts = "pinnedPostIds" in user ? (user as { pinnedPostIds?: unknown }).pinnedPostIds : undefined;
  const pinnedPostIds = Array.isArray(rawPinnedPosts)
    ? (rawPinnedPosts as string[]).filter((id): id is string => typeof id === "string")
    : [];

  const u = user as UserLike & {
    birthDate?: Date | null;
    gender?: string | null;
    favoriteMap?: string | null;
    playstyle?: string | null;
    quote?: string | null;
    country?: string | null;
    bio?: string | null;
  };
  return {
    id: user.id,
    name: user.name,
    nickname: user.nickname,
    team: user.team,
    mainClass: user.mainClass,
    level: user.level,
    avatar: user.avatar ?? "",
    achievements,
    pinnedAchievementIds,
    pinnedPostIds,
    reputation: [],
    online: user.online,
    isAiManaged: "isAiManaged" in user ? (user as { isAiManaged?: boolean }).isAiManaged : undefined,
    steamId64: user.steamId64 ?? undefined,
    steamProfileUrl: user.steamId64 ? `https://steamcommunity.com/profiles/${user.steamId64}` : undefined,
    steamGames,
    steamTotalPlaytimeMinutes: steamGames?.length ? steamTotalPlaytimeMinutes : undefined,
    birthDate: u.birthDate ? u.birthDate.toISOString().slice(0, 10) : undefined,
    gender: u.gender ?? undefined,
    favoriteMap: u.favoriteMap ?? undefined,
    playstyle: u.playstyle ?? undefined,
    quote: u.quote ?? undefined,
    country: u.country ?? undefined,
    bio: u.bio ?? undefined,
  };
}
