import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import SteamAuth from "node-steam-openid";
import { prisma } from "../db/client.js";
import { userToJSON } from "../views/userView.js";
import { toSteamId64, getPlayerSummaries } from "../services/steamService.js";
import { syncSteamDataForUser } from "../services/steamSyncService.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
const STEAM_LINK_TOKEN_EXPIRES = "10m";

/** Base URL of this backend (for Steam OpenID return_to). Must not be the frontend URL. */
function getBackendBaseUrl(): string {
  const url = process.env.BACKEND_URL;
  if (url) return url.replace(/\/$/, "");
  const port = process.env.PORT ?? 3000;
  return `http://localhost:${port}`;
}

function getSteamAuthInstance(returnUrl: string): SteamAuth {
  const apiKey = process.env.STEAM_WEB_API_KEY;
  if (!apiKey) throw new Error("STEAM_WEB_API_KEY is not set");
  const realm = getBackendBaseUrl();
  return new SteamAuth({
    realm,
    returnUrl,
    apiKey,
  });
}

/** POST /users/me/steam-link - Opção A: link by SteamID64 or vanity URL */
export async function linkSteam(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const steamId64Raw = req.body?.steamId64 as string | undefined;
  const vanityUrl = req.body?.vanityUrl as string | undefined;
  const input = steamId64Raw?.trim() || vanityUrl?.trim();
  if (!input) {
    res.status(400).json({ message: "Envie steamId64 ou vanityUrl no body" });
    return;
  }

  try {
    const steamId64 = await toSteamId64(input);
    if (!steamId64) {
      res.status(400).json({ message: "Perfil Steam não encontrado. Verifique o ID ou a URL." });
      return;
    }

    const summary = await getPlayerSummaries(steamId64);
    if (!summary) {
      res.status(400).json({ message: "Perfil Steam privado ou indisponível." });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { steamId64 } });
    if (existing && existing.id !== req.user.id) {
      res.status(400).json({ message: "Esta conta Steam já está vinculada a outro usuário." });
      return;
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        steamId64,
        steamLinkedAt: new Date(),
      },
    });

    await syncSteamDataForUser(req.user.id);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user.id },
      include: { steamGames: true, steamAchievements: true },
    });
    res.status(200).json(userToJSON(user));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao vincular Steam";
    if (message.includes("STEAM_WEB_API_KEY")) {
      res.status(503).json({ message: "Integração Steam não configurada." });
      return;
    }
    res.status(400).json({ message });
  }
}

/** GET /users/me/steam/auth - redirect to Steam OpenID. Auth via Bearer or query token (for browser redirect). */
export async function getSteamAuthUrl(req: Request, res: Response) {
  let userId: string | undefined = req.user?.id;
  if (!userId) {
    const queryToken = req.query?.token as string | undefined;
    if (queryToken) {
      try {
        const payload = jwt.verify(queryToken, JWT_SECRET) as { userId: string };
        userId = payload.userId;
      } catch {
        res.status(401).json({ message: "Token inválido ou expirado" });
        return;
      }
    }
  }
  if (!userId) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const base = getBackendBaseUrl();
  const linkToken = jwt.sign(
    { userId, purpose: "steam-link" },
    JWT_SECRET,
    { expiresIn: STEAM_LINK_TOKEN_EXPIRES }
  );
  const returnUrl = `${base}/users/me/steam/callback?link_token=${linkToken}`;

  try {
    const steam = getSteamAuthInstance(returnUrl);
    const redirectUrl = await steam.getRedirectUrl();
    res.redirect(redirectUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao iniciar login Steam";
    res.status(503).json({ message });
  }
}

/** GET /users/me/steam/callback - Steam OpenID return; link_token in query */
export async function steamCallback(req: Request, res: Response) {
  const linkToken = req.query?.link_token as string | undefined;
  if (!linkToken) {
    redirectToFrontend(res, false, "Token de vinculação ausente.");
    return;
  }
  let userId: string;
  try {
    const payload = jwt.verify(linkToken, JWT_SECRET) as { userId: string; purpose?: string };
    if (payload.purpose !== "steam-link") throw new Error("Invalid purpose");
    userId = payload.userId;
  } catch {
    redirectToFrontend(res, false, "Token inválido ou expirado.");
    return;
  }

  const base = getBackendBaseUrl();
  const returnUrl = `${base}/users/me/steam/callback?link_token=${linkToken}`;

  try {
    const steam = getSteamAuthInstance(returnUrl);
    const fullUrl = req.originalUrl?.startsWith("http") ? req.originalUrl : `${base}${req.originalUrl || req.url || ""}`;
    const steamUser = await steam.authenticate({ url: fullUrl });
    const steamId64 = steamUser.steamid;

    const existing = await prisma.user.findUnique({ where: { steamId64 } });
    if (existing && existing.id !== userId) {
      redirectToFrontend(res, false, "Esta conta Steam já está vinculada a outro usuário.");
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { steamId64, steamLinkedAt: new Date() },
    });

    await syncSteamDataForUser(userId);
    redirectToFrontend(res, true);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao verificar conta Steam.";
    redirectToFrontend(res, false, message);
  }
}

function redirectToFrontend(res: Response, success: boolean, message?: string) {
  const frontendUrl = process.env.CORS_ORIGIN ?? "http://localhost:8080";
  const params = new URLSearchParams({ steam_link: success ? "ok" : "error" });
  if (message) params.set("message", message);
  res.redirect(`${frontendUrl}/settings?${params.toString()}`);
}

/** POST /users/me/steam/unlink */
export async function unlinkSteam(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  await prisma.userSteamAchievement.deleteMany({ where: { userId: req.user.id } });
  await prisma.userSteamGame.deleteMany({ where: { userId: req.user.id } });
  await prisma.user.update({
    where: { id: req.user.id },
    data: { steamId64: null, steamLinkedAt: null },
  });
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user.id },
    include: { steamGames: true, steamAchievements: true },
  });
  res.status(200).json(userToJSON(user));
}

/** POST /users/me/steam/sync */
export async function syncSteam(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  try {
    const result = await syncSteamDataForUser(req.user.id);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user.id },
      include: { steamGames: true, steamAchievements: true },
    });
    res.status(200).json({ ...userToJSON(user), steamSync: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao sincronizar.";
    res.status(400).json({ message });
  }
}
