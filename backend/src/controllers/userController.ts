import type { Request, Response } from "express";
import { prisma } from "../db/client.js";
import { userToJSON } from "../views/userView.js";
import {
  listFriends,
  listBlockedUsers,
  listUsersAvailableToAdd,
  listRecommendedToAdd,
  addFriend as addFriendService,
  removeFriend as removeFriendService,
  blockUser as blockUserService,
  unblockUser as unblockUserService,
  listPendingFriendRequestsForUser,
  acceptFriendRequest as acceptFriendRequestService,
  declineFriendRequest as declineFriendRequestService,
} from "../services/userService.js";
import { listCommunitiesWhereMember } from "../services/communityService.js";
import { listUserMedia } from "../services/feedService.js";

export async function getMe(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user.id },
    include: { steamGames: true, steamAchievements: true },
  });
  res.status(200).json(userToJSON(user));
}

const MAX_BIO_LENGTH = 500;
const MAX_QUOTE_LENGTH = 200;
const MAX_STRING_FIELD = 100;

export async function updateMe(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const body = req.body ?? {};
  const data: {
    avatar?: string | null;
    name?: string;
    nickname?: string;
    birthDate?: Date | null;
    gender?: string | null;
    favoriteMap?: string | null;
    playstyle?: string | null;
    quote?: string | null;
    country?: string | null;
    bio?: string | null;
  } = {};

  if (body.avatar !== undefined) {
    if (typeof body.avatar !== "string" && body.avatar !== null) {
      res.status(400).json({ message: "avatar deve ser uma string (URL) ou null" });
      return;
    }
    data.avatar = body.avatar === "" ? null : body.avatar;
  }
  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim().slice(0, MAX_STRING_FIELD);
  }
  if (typeof body.nickname === "string" && body.nickname.trim()) {
    const nick = body.nickname.trim().slice(0, MAX_STRING_FIELD);
    const existing = await prisma.user.findFirst({
      where: { nickname: nick, id: { not: req.user.id } },
    });
    if (existing) {
      res.status(400).json({ message: "Este nickname já está em uso" });
      return;
    }
    data.nickname = nick;
  }
  if (body.birthDate !== undefined) {
    if (body.birthDate === null || body.birthDate === "") {
      data.birthDate = null;
    } else if (typeof body.birthDate === "string") {
      const d = new Date(body.birthDate);
      if (!Number.isNaN(d.getTime())) data.birthDate = d;
    }
  }
  if (body.gender !== undefined) {
    data.gender = body.gender === null || body.gender === "" ? null : String(body.gender).slice(0, MAX_STRING_FIELD);
  }
  if (body.favoriteMap !== undefined) {
    data.favoriteMap = body.favoriteMap === null || body.favoriteMap === "" ? null : String(body.favoriteMap).slice(0, MAX_STRING_FIELD);
  }
  if (body.playstyle !== undefined) {
    data.playstyle = body.playstyle === null || body.playstyle === "" ? null : String(body.playstyle).slice(0, MAX_STRING_FIELD);
  }
  if (body.quote !== undefined) {
    data.quote = body.quote === null || body.quote === "" ? null : String(body.quote).slice(0, MAX_QUOTE_LENGTH);
  }
  if (body.country !== undefined) {
    data.country = body.country === null || body.country === "" ? null : String(body.country).slice(0, MAX_STRING_FIELD);
  }
  if (body.bio !== undefined) {
    data.bio = body.bio === null || body.bio === "" ? null : String(body.bio).slice(0, MAX_BIO_LENGTH);
  }

  if (Object.keys(data).length === 0) {
    res.status(400).json({ message: "Nenhum campo para atualizar" });
    return;
  }
  await prisma.user.update({
    where: { id: req.user.id },
    data,
  });
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user.id },
    include: { steamGames: true, steamAchievements: true },
  });
  res.status(200).json(userToJSON(user));
}

export async function updatePinnedAchievements(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const achievementIds = req.body?.achievementIds;
  if (!Array.isArray(achievementIds)) {
    res.status(400).json({ message: "achievementIds deve ser um array de strings" });
    return;
  }
  const ids = achievementIds.filter((id): id is string => typeof id === "string");
  await prisma.user.update({
    where: { id: req.user.id },
    data: { pinnedAchievementIds: ids },
  });
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user.id },
    include: { steamGames: true, steamAchievements: true },
  });
  res.status(200).json(userToJSON(user));
}

const MAX_PINNED_POSTS = 3;

export async function updatePinnedPosts(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const raw = req.body?.pinnedPostIds;
  if (!Array.isArray(raw)) {
    res.status(400).json({ message: "pinnedPostIds deve ser um array de strings" });
    return;
  }
  const requested = (raw as unknown[]).filter((id): id is string => typeof id === "string").slice(0, MAX_PINNED_POSTS);
  const userId = req.user.id;

  const [myFeedIds, myScrapIds] = await Promise.all([
    prisma.feedItem.findMany({ where: { userId }, select: { id: true } }).then((r) => r.map((x) => x.id)),
    prisma.scrapMessage
      .findMany({
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
        select: { id: true },
      })
      .then((r) => r.map((x) => x.id)),
  ]);
  const allowedIds = new Set([...myFeedIds, ...myScrapIds]);
  const ids = requested.filter((id) => allowedIds.has(id));

  await prisma.user.update({
    where: { id: userId },
    data: { pinnedPostIds: ids },
  });
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { steamGames: true, steamAchievements: true },
  });
  res.status(200).json(userToJSON(user));
}

export async function getUserById(req: Request, res: Response) {
  const userId = req.params.userId;
  if (!userId) {
    res.status(400).json({ message: "userId é obrigatório" });
    return;
  }
  if (userId === "me") {
    res.status(400).json({ message: "Use GET /users/me para o seu perfil" });
    return;
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { steamGames: true, steamAchievements: true },
    });
    if (!user) {
      res.status(404).json({ message: "Usuário não encontrado" });
      return;
    }
    res.status(200).json(userToJSON(user));
  } catch {
    res.status(500).json({ message: "Erro ao carregar perfil" });
  }
}

export async function getUserFriends(req: Request, res: Response) {
  const userId = req.params.userId;
  if (!userId) {
    res.status(400).json({ message: "userId é obrigatório" });
    return;
  }
  try {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!target) {
      res.status(404).json({ message: "Usuário não encontrado" });
      return;
    }
    const users = await listFriends(userId);
    res.status(200).json(users.map(userToJSON));
  } catch {
    res.status(500).json({ message: "Erro ao carregar amigos" });
  }
}

export async function getUserCommunities(req: Request, res: Response) {
  const userId = req.params.userId;
  if (!userId) {
    res.status(400).json({ message: "userId é obrigatório" });
    return;
  }
  try {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!target) {
      res.status(404).json({ message: "Usuário não encontrado" });
      return;
    }
    const communities = await listCommunitiesWhereMember(userId);
    const json = communities.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      memberCount: c.memberCount,
      dominantClass: c.dominantClass,
      team: c.team,
    }));
    res.status(200).json(json);
  } catch {
    res.status(500).json({ message: "Erro ao carregar comunidades" });
  }
}

export async function getUserMedia(req: Request, res: Response) {
  const userId = req.params.userId;
  if (!userId) {
    res.status(400).json({ message: "userId é obrigatório" });
    return;
  }
  try {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!target) {
      res.status(404).json({ message: "Usuário não encontrado" });
      return;
    }
    const items = await listUserMedia(userId);
    const json = items.map(({ url, type, filename, feedItemId, scrapId }) => ({
      url,
      type,
      ...(filename != null && { filename }),
      ...(feedItemId != null && { feedItemId }),
      ...(scrapId != null && { scrapId }),
    }));
    res.status(200).json({ items: json });
  } catch {
    res.status(500).json({ message: "Erro ao carregar mídia" });
  }
}

export async function getFriends(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  try {
    const users = await listFriends(req.user.id);
    res.status(200).json(users.map(userToJSON));
  } catch {
    res.status(500).json({ message: "Erro ao carregar squad" });
  }
}

export async function getBlocked(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  try {
    const users = await listBlockedUsers(req.user.id);
    res.status(200).json(users.map(userToJSON));
  } catch {
    res.status(500).json({ message: "Erro ao carregar bloqueados" });
  }
}

export async function getAvailableToAdd(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const users = await listUsersAvailableToAdd(req.user.id, { search });
    res.status(200).json(users.map(userToJSON));
  } catch {
    res.status(500).json({ message: "Erro ao carregar usuários" });
  }
}

export async function getRecommendations(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  try {
    const users = await listRecommendedToAdd(req.user.id);
    res.status(200).json(users.map(userToJSON));
  } catch {
    res.status(500).json({ message: "Erro ao carregar recomendações" });
  }
}

export async function addFriend(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const userId = req.body?.userId as string | undefined;
  if (!userId || typeof userId !== "string") {
    res.status(400).json({ message: "userId é obrigatório" });
    return;
  }
  try {
    const result = await addFriendService(req.user.id, userId);
    if (result === "already_friends") {
      res.status(200).json({ message: "Já são amigos" });
      return;
    }
    if (result === "blocked" || result === "invalid") {
      res.status(400).json({ message: "Não foi possível adicionar (bloqueado ou usuário inválido)" });
      return;
    }
    if (result === "request_sent") {
      res.status(201).json({ message: "Solicitação enviada" });
      return;
    }
    res.status(400).json({ message: "Não foi possível adicionar" });
  } catch {
    res.status(500).json({ message: "Erro ao adicionar amigo" });
  }
}

export async function getMyFriendRequests(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  try {
    const requests = await listPendingFriendRequestsForUser(req.user.id);
    res.status(200).json(
      requests.map((r) => ({
        id: r.id,
        fromUserId: r.fromUserId,
        from: userToJSON(r.from),
        createdAt: r.createdAt.toISOString(),
      }))
    );
  } catch {
    res.status(500).json({ message: "Erro ao carregar solicitações" });
  }
}

export async function acceptFriendRequest(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const requestId = req.params.requestId;
  if (!requestId) {
    res.status(400).json({ message: "requestId é obrigatório" });
    return;
  }
  try {
    const ok = await acceptFriendRequestService(requestId, req.user.id);
    if (!ok) {
      res.status(403).json({ message: "Solicitação inválida ou já processada" });
      return;
    }
    res.status(200).json({ message: "Amigo adicionado à squad" });
  } catch {
    res.status(500).json({ message: "Erro ao aceitar solicitação" });
  }
}

export async function declineFriendRequest(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const requestId = req.params.requestId;
  if (!requestId) {
    res.status(400).json({ message: "requestId é obrigatório" });
    return;
  }
  try {
    const ok = await declineFriendRequestService(requestId, req.user.id);
    if (!ok) {
      res.status(403).json({ message: "Solicitação inválida ou já processada" });
      return;
    }
    res.status(200).json({ message: "Solicitação recusada" });
  } catch {
    res.status(500).json({ message: "Erro ao recusar solicitação" });
  }
}

export async function removeFriend(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const userId = req.params.userId;
  if (!userId) {
    res.status(400).json({ message: "userId é obrigatório" });
    return;
  }
  try {
    await removeFriendService(req.user.id, userId);
    res.status(200).json({ message: "Amigo removido" });
  } catch {
    res.status(500).json({ message: "Erro ao remover amigo" });
  }
}

export async function blockUser(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const userId = req.params.userId;
  if (!userId) {
    res.status(400).json({ message: "userId é obrigatório" });
    return;
  }
  try {
    const ok = await blockUserService(req.user.id, userId);
    if (!ok) {
      res.status(400).json({ message: "Não foi possível bloquear" });
      return;
    }
    res.status(200).json({ message: "Usuário bloqueado" });
  } catch {
    res.status(500).json({ message: "Erro ao bloquear" });
  }
}

export async function unblockUser(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const userId = req.params.userId;
  if (!userId) {
    res.status(400).json({ message: "userId é obrigatório" });
    return;
  }
  try {
    await unblockUserService(req.user.id, userId);
    res.status(200).json({ message: "Usuário desbloqueado" });
  } catch {
    res.status(500).json({ message: "Erro ao desbloquear" });
  }
}
