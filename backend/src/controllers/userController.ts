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

export async function updateMe(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const avatar = req.body?.avatar;
  if (avatar !== undefined && typeof avatar !== "string") {
    res.status(400).json({ message: "avatar deve ser uma string (URL) ou null" });
    return;
  }
  const data: { avatar?: string | null } = {};
  if (avatar !== undefined) data.avatar = avatar === "" ? null : avatar;
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
    const ok = await addFriendService(req.user.id, userId);
    if (!ok) {
      res.status(400).json({ message: "Não foi possível adicionar (já é amigo, bloqueado ou usuário inválido)" });
      return;
    }
    res.status(201).json({ message: "Amigo adicionado" });
  } catch {
    res.status(500).json({ message: "Erro ao adicionar amigo" });
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
