/**
 * Steam Web API service.
 * Requires STEAM_WEB_API_KEY. Base: https://api.steampowered.com/
 */

const STEAM_API_BASE = "https://api.steampowered.com";

function getApiKey(): string {
  const key = process.env.STEAM_WEB_API_KEY;
  if (!key) {
    throw new Error("STEAM_WEB_API_KEY is not set");
  }
  return key;
}

async function steamFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = getApiKey();
  const search = new URLSearchParams({ key, ...params });
  const url = `${STEAM_API_BASE}${path}?${search.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Steam API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// --- ResolveVanityURL ---
interface ResolveVanityURLResponse {
  response?: { steamid?: string; success: number };
}

/**
 * Resolve custom profile URL (e.g. /id/username) to SteamID64.
 * Returns null if vanity URL not found (success === 42).
 */
export async function resolveVanityUrl(vanityUrl: string): Promise<string | null> {
  const vanity = vanityUrl.replace(/^https?:\/\/steamcommunity\.com\/id\//i, "").replace(/\/$/, "");
  if (!vanity) return null;
  const data = await steamFetch<ResolveVanityURLResponse>(
    "/ISteamUser/ResolveVanityURL/v1/",
    { vanityurl: vanity }
  );
  const success = data.response?.success;
  if (success === 42 || !data.response?.steamid) return null;
  return data.response.steamid;
}

/**
 * Normalize input to SteamID64: if it's a number (17 digits) or full URL with id, return as-is or resolve.
 */
export async function toSteamId64(input: string): Promise<string | null> {
  const trimmed = input.trim();
  if (/^\d{17}$/.test(trimmed)) return trimmed;
  if (/steamcommunity\.com\/id\//i.test(trimmed)) return resolveVanityUrl(trimmed);
  return resolveVanityUrl(trimmed);
}

// --- GetPlayerSummaries ---
export interface SteamPlayerSummary {
  steamid: string;
  personaname: string;
  profileurl: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
  personastate?: number;
  gameid?: string;
  gameextrainfo?: string;
  timecreated?: number;
}

interface GetPlayerSummariesResponse {
  response?: { players?: SteamPlayerSummary[] };
}

export async function getPlayerSummaries(steamId64: string): Promise<SteamPlayerSummary | null> {
  const data = await steamFetch<GetPlayerSummariesResponse>(
    "/ISteamUser/GetPlayerSummaries/v2/",
    { steamids: steamId64 }
  );
  const players = data.response?.players;
  if (!players?.length) return null;
  return players[0];
}

// --- GetOwnedGames ---
export interface SteamOwnedGame {
  appid: number;
  name: string;
  playtime_forever: number;
  playtime_2weeks?: number;
  img_icon_url: string;
  img_logo_url?: string;
}

interface GetOwnedGamesResponse {
  response?: { games?: SteamOwnedGame[]; game_count?: number };
}

export async function getOwnedGames(steamId64: string): Promise<SteamOwnedGame[]> {
  const data = await steamFetch<GetOwnedGamesResponse>(
    "/IPlayerService/GetOwnedGames/v1/",
    { steamid: steamId64, include_appinfo: "1", include_played_free_games: "1" }
  );
  return data.response?.games ?? [];
}

// --- GetPlayerAchievements ---
export interface SteamPlayerAchievement {
  apiname: string;
  achieved: 0 | 1;
  unlocktime: number;
  name?: string;
  description?: string;
}

interface GetPlayerAchievementsResponse {
  playerstats?: {
    steamID: string;
    gameName: string;
    achievements?: SteamPlayerAchievement[];
    success?: boolean;
  };
}

export async function getPlayerAchievements(
  steamId64: string,
  appId: number
): Promise<SteamPlayerAchievement[]> {
  const data = await steamFetch<GetPlayerAchievementsResponse>(
    "/ISteamUserStats/GetPlayerAchievements/v1/",
    { steamid: steamId64, appid: String(appId) }
  );
  // Check if API returned success: false (e.g., private profile, no stats)
  if (data.playerstats?.success === false) {
    return [];
  }
  const list = data.playerstats?.achievements;
  if (!list) return [];
  return list;
}

// --- GetSchemaForGame ---
export interface SteamSchemaAchievement {
  name: string;
  defaultvalue: number;
  displayName: { "#cdata": string } | string;
  description: { "#cdata": string } | string;
  icon: string;
  icongray: string;
}

interface GetSchemaForGameResponse {
  game?: {
    availableGameStats?: {
      achievements?: SteamSchemaAchievement[];
    };
  };
}

function stripCdata(value: { "#cdata"?: string } | string | undefined | null): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value["#cdata"] ?? "";
}

export async function getSchemaForGame(appId: number): Promise<SteamSchemaAchievement[]> {
  const data = await steamFetch<GetSchemaForGameResponse>(
    "/ISteamUserStats/GetSchemaForGame/v2/",
    { appid: String(appId) }
  );
  const list = data.game?.availableGameStats?.achievements;
  return list ?? [];
}

/** Base URL for Steam achievement icons (CDN). */
export const STEAM_CDN_ICON = "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps";

/**
 * Build icon URL for a game achievement. Schema gives icon filename (e.g. "fghij123").
 * Full URL: https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/{appid}/{icon}.jpg
 */
export function steamAchievementIconUrl(appId: number, iconPath: string): string {
  if (!iconPath) return "";
  const base = iconPath.startsWith("http") ? "" : `${STEAM_CDN_ICON}/${appId}/${iconPath}`;
  return base || iconPath;
}

/**
 * Build icon URL for game library (img_icon_url is just a hash).
 * Format: https://media.steampowered.com/steamcommunity/public/images/apps/{appid}/{hash}.jpg
 */
export function steamGameIconUrl(appId: number, hash: string): string {
  if (!hash) return "";
  return `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${hash}.jpg`;
}

// --- GetBadges (IPlayerService) - used to get Steam profile level ---
interface GetBadgesResponse {
  response?: {
    player_level?: number;
    player_xp?: number;
  };
}

/**
 * Get Steam profile level for a user (from IPlayerService/GetBadges).
 * Returns null if API fails or profile is private.
 */
export async function getSteamPlayerLevel(steamId64: string): Promise<number | null> {
  try {
    const data = await steamFetch<GetBadgesResponse>(
      "/IPlayerService/GetBadges/v1/",
      { steamid: steamId64 }
    );
    const level = data.response?.player_level;
    return typeof level === "number" && level >= 0 ? level : null;
  } catch {
    return null;
  }
}
