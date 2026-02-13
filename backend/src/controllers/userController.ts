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
