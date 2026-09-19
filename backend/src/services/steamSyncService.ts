import { prisma } from "../db/client.js";
import { log } from "../platform/observability/index.js";
import {
  getOwnedGames,
  getPlayerAchievements,
  getSchemaForGame,
  getSteamPlayerLevel,
  steamAchievementIconUrl,
  steamGameIconUrl,
  type SteamPlayerAchievement,
  type SteamSchemaAchievement,
} from "./steamService.js";

const STEAM_SYNC_COOLDOWN_MINUTES = 1; // Reduced for debugging

function stripCdata(value: { "#cdata": string } | string | undefined | null): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return (value as { "#cdata"?: string })["#cdata"] ?? "";
}

export async function syncSteamDataForUser(userId: string): Promise<{ gamesCount: number; achievementsCount: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { steamId64: true },
  });
  if (!user?.steamId64) {
    throw new Error("Usuário não possui conta Steam vinculada");
  }
  const steamId64 = user.steamId64;

  const lastGame = await prisma.userSteamGame.findFirst({
    where: { userId },
    orderBy: { lastSyncedAt: "desc" },
  });
  if (lastGame) {
    const cooldown = STEAM_SYNC_COOLDOWN_MINUTES * 60 * 1000;
    if (Date.now() - lastGame.lastSyncedAt.getTime() < cooldown) {
      const gamesCount = await prisma.userSteamGame.count({ where: { userId } });
      const achievementsCount = await prisma.userSteamAchievement.count({ where: { userId } });
      return { gamesCount, achievementsCount };
    }
  }

  const games = await getOwnedGames(steamId64);

  await prisma.userSteamGame.deleteMany({ where: { userId } });
  for (const g of games) {
    await prisma.userSteamGame.create({
      data: {
        userId,
        appId: g.appid,
        name: g.name,
        iconUrl: steamGameIconUrl(g.appid, g.img_icon_url),
        playtimeMinutes: g.playtime_forever ?? 0,
        playtime2WeeksMinutes: g.playtime_2weeks ?? 0,
      },
    });
  }

  const ownedAppIds = games.map((g) => g.appid);
  log.info({
    event: "steam.sync.started",
    outcome: "success",
  });
  
  for (let i = 0; i < ownedAppIds.length; i++) {
    const appId = ownedAppIds[i];
    
    // Small delay to avoid rate limiting (except for first request)
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    let playerAchs: SteamPlayerAchievement[];
    let schemaAchs: SteamSchemaAchievement[];
    try {
      [playerAchs, schemaAchs] = await Promise.all([
        getPlayerAchievements(steamId64, appId),
        getSchemaForGame(appId),
      ]);
    } catch (err) {
      // Many games don't have achievements or API may fail - skip silently
      log.warn({
        event: "steam.sync.game_skipped",
        dependency: "steam",
        outcome: "failure",
        failureCategory: "unknown",
      });
      continue;
    }

    // Skip if no achievements found
    if (!playerAchs || playerAchs.length === 0) {
      log.info({
        event: "steam.sync.game_skipped",
        dependency: "steam",
        outcome: "success",
        failureCategory: "none",
      });
      continue;
    }

    const schemaMap = new Map<string, SteamSchemaAchievement>();
    for (const a of schemaAchs) schemaMap.set(a.name, a);

    await prisma.userSteamAchievement.deleteMany({ where: { userId, appId } });
    let unlockedCount = 0;
    let totalCount = 0;
    for (const a of playerAchs) {
      totalCount++;
      const schema = schemaMap.get(a.apiname);
      const title = schema ? stripCdata(schema?.displayName) : a.name ?? a.apiname;
      const description = schema ? stripCdata(schema?.description) : (a.description ?? undefined);
      const iconUrl = schema?.icon ? steamAchievementIconUrl(appId, schema.icon) : undefined;
      const unlockedAt = a.achieved === 1 && a.unlocktime ? new Date(a.unlocktime * 1000) : null;
      if (unlockedAt) unlockedCount++;
      
      await prisma.userSteamAchievement.create({
        data: {
          userId,
          appId,
          apiName: a.apiname,
          title,
          description: description ?? null,
          iconUrl: iconUrl ?? null,
          unlockedAt,
        },
      });
    }
    
    log.info({
      event: "steam.sync.game_completed",
      dependency: "steam",
      outcome: "success",
    });
  }

  // Atualizar nível do perfil com o nível da Steam
  const steamLevel = await getSteamPlayerLevel(steamId64);
  if (steamLevel != null && steamLevel >= 1) {
    await prisma.user.update({
      where: { id: userId },
      data: { level: steamLevel },
    });
  }

  const gamesCount = await prisma.userSteamGame.count({ where: { userId } });
  const achievementsCount = await prisma.userSteamAchievement.count({ where: { userId } });
  return { gamesCount, achievementsCount };
}
