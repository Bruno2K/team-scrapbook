import type { Request, Response } from "express";
import type { Community as PrismaCommunity } from "@prisma/client";
import {
  communityToJSON,
  communityWithMetaToJSON,
  communityDetailToJSON,
  communityMemberToJSON,
  type CommunityDetailJSON,
} from "../views/communityView.js";
import { feedItemToJSON } from "../views/feedView.js";
import {
  listCommunities,
  listCommunitiesWhereMember,
  listRecommendedCommunities,
  listHypeCommunities,
  getCommunityById,
  getMember,
  canManageCommunity,
  createCommunity as createCommunityService,
  updateCommunity as updateCommunityService,
  deleteCommunity as deleteCommunityService,
  joinCommunity as joinCommunityService,
  leaveCommunity as leaveCommunityService,
  listCommunityMembers,
  removeMember as removeMemberService,
  listCommunityPosts,
  createCommunityPost,
} from "../services/communityService.js";

function isCommunityWithMeta(
  c: Awaited<ReturnType<typeof listCommunities>>
): c is import("../services/communityService.js").CommunityWithMeta[] {
  return Array.isArray(c) && c.length > 0 && "isMember" in c[0];
}

export async function getCommunities(req: Request, res: Response) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const memberOnly = req.query.memberOnly === "true";
    const userId = req.user?.id;

    if (memberOnly && userId) {
      const list = await listCommunitiesWhereMember(userId, 50);
      return res.status(200).json(list.map(communityWithMetaToJSON));
    }

    const list = await listCommunities({ userId, search, limit: 50 });
    if (isCommunityWithMeta(list)) {
      return res.status(200).json(list.map(communityWithMetaToJSON));
    }
    res.status(200).json((list as PrismaCommunity[]).map(communityToJSON));
  } catch {
    res.status(500).json({ message: "Erro ao carregar comunidades" });
  }
}

export async function getRecommendedCommunities(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(200).json([]);
    }
    const list = await listRecommendedCommunities(userId, 20);
    res.status(200).json(list.map(communityWithMetaToJSON));
  } catch {
    res.status(500).json({ message: "Erro ao carregar recomendações" });
  }
}

export async function getHypeCommunities(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const list = await listHypeCommunities({ userId, limit: 20 });
    res.status(200).json(list.map(communityWithMetaToJSON));
  } catch {
    res.status(500).json({ message: "Erro ao carregar comunidades em hype" });
  }
}

export async function getCommunity(req: Request, res: Response) {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ message: "ID da comunidade é obrigatório" });
    return;
  }
  try {
    const community = await getCommunityById(id);
    if (!community) {
      res.status(404).json({ message: "Comunidade não encontrada" });
      return;
    }
    const userId = req.user?.id;
    const membership = userId ? await getMember(userId, id) : null;
    const isMember = !!membership;
    const isAdmin = membership?.role === "ADMIN" || community.ownerId === userId;
    const json: CommunityDetailJSON = communityDetailToJSON(community, isMember, isAdmin);
    res.status(200).json(json);
  } catch {
    res.status(500).json({ message: "Erro ao carregar comunidade" });
  }
}

export async function createCommunity(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const { name, description, dominantClass, team } = req.body ?? {};
  if (!name || typeof name !== "string" || name.trim() === "") {
    res.status(400).json({ message: "Nome é obrigatório" });
    return;
  }
  if (!description || typeof description !== "string" || description.trim() === "") {
    res.status(400).json({ message: "Descrição é obrigatória" });
    return;
  }
  try {
    const community = await createCommunityService({
      userId: req.user.id,
      name: name.trim(),
      description: description.trim(),
      dominantClass: dominantClass || undefined,
      team: team || undefined,
    });
    if (!community) {
      res.status(500).json({ message: "Erro ao criar comunidade" });
      return;
    }
    res.status(201).json(communityToJSON(community));
  } catch {
    res.status(500).json({ message: "Erro ao criar comunidade" });
  }
}

export async function updateCommunity(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ message: "ID da comunidade é obrigatório" });
    return;
  }
  const canManage = await canManageCommunity(req.user.id, id);
  if (!canManage) {
    res.status(403).json({ message: "Sem permissão para editar esta comunidade" });
    return;
  }
  const { name, description, dominantClass, team } = req.body ?? {};
  try {
    const data: import("../services/communityService.js").UpdateCommunityInput = {};
    if (typeof name === "string" && name.trim()) data.name = name.trim();
    if (typeof description === "string") data.description = description.trim();
    if (dominantClass !== undefined) data.dominantClass = dominantClass as import("@prisma/client").TF2Class | null;
    if (team !== undefined) data.team = team as import("@prisma/client").Team | null;
    await updateCommunityService(id, data);
    res.status(200).json({ message: "Comunidade atualizada" });
  } catch {
    res.status(500).json({ message: "Erro ao atualizar comunidade" });
  }
}

export async function deleteCommunity(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ message: "ID da comunidade é obrigatório" });
    return;
  }
  const canManage = await canManageCommunity(req.user.id, id);
  if (!canManage) {
    res.status(403).json({ message: "Sem permissão para excluir esta comunidade" });
    return;
  }
  try {
    await deleteCommunityService(id);
    res.status(200).json({ message: "Comunidade excluída" });
  } catch {
    res.status(500).json({ message: "Erro ao excluir comunidade" });
  }
}

export async function joinCommunity(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ message: "ID da comunidade é obrigatório" });
    return;
  }
  try {
    await joinCommunityService(req.user.id, id);
    res.status(200).json({ message: "Você entrou na comunidade" });
  } catch {
    res.status(500).json({ message: "Erro ao entrar na comunidade" });
  }
}

export async function leaveCommunity(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ message: "ID da comunidade é obrigatório" });
    return;
  }
  try {
    const ok = await leaveCommunityService(req.user.id, id);
    if (!ok) {
      res.status(400).json({ message: "Não foi possível sair (dono não pode sair)" });
      return;
    }
    res.status(200).json({ message: "Você saiu da comunidade" });
  } catch {
    res.status(500).json({ message: "Erro ao sair da comunidade" });
  }
}

export async function getCommunityMembers(req: Request, res: Response) {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ message: "ID da comunidade é obrigatório" });
    return;
  }
  try {
    const members = await listCommunityMembers(id);
    res.status(200).json(members.map(communityMemberToJSON));
  } catch {
    res.status(500).json({ message: "Erro ao carregar membros" });
  }
}

export async function removeMember(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const communityId = req.params.id;
  const userId = req.params.userId;
  if (!communityId || !userId) {
    res.status(400).json({ message: "ID da comunidade e do usuário são obrigatórios" });
    return;
  }
  try {
    const ok = await removeMemberService(communityId, userId, req.user.id);
    if (!ok) {
      res.status(403).json({ message: "Não foi possível remover este membro" });
      return;
    }
    res.status(200).json({ message: "Membro removido" });
  } catch {
    res.status(500).json({ message: "Erro ao remover membro" });
  }
}

export async function getCommunityPosts(req: Request, res: Response) {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ message: "ID da comunidade é obrigatório" });
    return;
  }
  try {
    const items = await listCommunityPosts(id);
    res.status(200).json(items.map(feedItemToJSON));
  } catch {
    res.status(500).json({ message: "Erro ao carregar publicações" });
  }
}

export async function postToCommunity(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const id = req.params.id;
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  const allowComments = req.body?.allowComments !== false;
  const allowReactions = req.body?.allowReactions !== false;
  const rawAttachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
  const attachments = rawAttachments.filter(
    (a: unknown): a is { url: string; type: string; filename?: string } =>
      typeof a === "object" &&
      a !== null &&
      typeof (a as { url?: unknown }).url === "string" &&
      ["image", "video", "audio", "document"].includes((a as { type?: string }).type ?? "")
  );
  if (!id) {
    res.status(400).json({ message: "ID da comunidade é obrigatório" });
    return;
  }
  if (!content && attachments.length === 0) {
    res.status(400).json({ message: "Conteúdo ou anexos são obrigatórios" });
    return;
  }
  try {
    const item = await createCommunityPost(req.user.id, id, {
      content: content || "",
      allowComments,
      allowReactions,
      attachments: attachments.length ? attachments : undefined,
    });
    if (!item) {
      res.status(403).json({ message: "Apenas membros podem publicar" });
      return;
    }
    res.status(201).json(feedItemToJSON(item));
  } catch {
    res.status(500).json({ message: "Erro ao publicar" });
  }
}
