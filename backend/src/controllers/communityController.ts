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
  createInvite,
  listPendingInvitesForUser,
  listCommunityInvites,
  acceptInvite,
  declineInvite,
  createJoinRequest,
  listJoinRequests,
  getPendingJoinRequest,
  approveJoinRequest,
  rejectJoinRequest,
  updateMemberRole,
} from "../services/communityService.js";
import type { CommunityMemberRoleValue } from "../services/communityService.js";

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
    const isModerator = isAdmin || membership?.role === "MODERATOR";
    const json: CommunityDetailJSON = communityDetailToJSON(community, isMember, isAdmin, isModerator);
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
  const { name, description, isPrivate, dominantClass, team } = req.body ?? {};
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
      isPrivate: isPrivate === true,
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
  const { name, description, isPrivate, dominantClass, team } = req.body ?? {};
  try {
    const data: import("../services/communityService.js").UpdateCommunityInput = {};
    if (typeof name === "string" && name.trim()) data.name = name.trim();
    if (typeof description === "string") data.description = description.trim();
    if (typeof isPrivate === "boolean") data.isPrivate = isPrivate;
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
  } catch (err) {
    const code = (err as Error & { code?: string }).code;
    if (code === "COMMUNITY_PRIVATE") {
      res.status(403).json({ message: "Comunidade privada; solicite entrada ou aguarde convite." });
      return;
    }
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
    const community = await getCommunityById(id);
    if (!community) {
      res.status(404).json({ message: "Comunidade não encontrada" });
      return;
    }
    if (community.isPrivate) {
      if (!req.user?.id) {
        res.status(403).json({ message: "Esta comunidade é privada. Solicite entrada ou aguarde um convite para ver os membros." });
        return;
      }
      const membership = await getMember(req.user.id, id);
      if (!membership) {
        res.status(403).json({ message: "Esta comunidade é privada. Solicite entrada ou aguarde um convite para ver os membros." });
        return;
      }
    }
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
    const community = await getCommunityById(id);
    if (!community) {
      res.status(404).json({ message: "Comunidade não encontrada" });
      return;
    }
    if (community.isPrivate) {
      if (!req.user?.id) {
        res.status(403).json({ message: "Esta comunidade é privada. Solicite entrada ou aguarde um convite para ver o feed." });
        return;
      }
      const membership = await getMember(req.user.id, id);
      if (!membership) {
        res.status(403).json({ message: "Esta comunidade é privada. Solicite entrada ou aguarde um convite para ver o feed." });
        return;
      }
    }
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

// --- Invites (private communities) ---

export async function postInvite(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const communityId = req.params.id;
  const inviteeId = typeof req.body?.inviteeId === "string" ? req.body.inviteeId.trim() : "";
  if (!communityId || !inviteeId) {
    res.status(400).json({ message: "communityId e inviteeId são obrigatórios" });
    return;
  }
  try {
    const invite = await createInvite(communityId, req.user.id, inviteeId);
    if (!invite) {
      res.status(403).json({ message: "Não foi possível enviar o convite" });
      return;
    }
    res.status(201).json({
      id: invite.id,
      communityId: invite.communityId,
      inviteeId: invite.inviteeId,
      status: invite.status,
      createdAt: invite.createdAt.toISOString(),
    });
  } catch {
    res.status(500).json({ message: "Erro ao enviar convite" });
  }
}

export async function getMyPendingInvites(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  try {
    const invites = await listPendingInvitesForUser(req.user.id);
    res.status(200).json(
      invites.map((i) => ({
        id: i.id,
        communityId: i.communityId,
        community: { id: i.community.id, name: i.community.name },
        inviter: { id: i.inviter.id, nickname: i.inviter.nickname, name: i.inviter.name },
        createdAt: i.createdAt.toISOString(),
      }))
    );
  } catch {
    res.status(500).json({ message: "Erro ao carregar convites" });
  }
}

export async function getCommunityInvites(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const communityId = req.params.id;
  if (!communityId) {
    res.status(400).json({ message: "ID da comunidade é obrigatório" });
    return;
  }
  try {
    const invites = await listCommunityInvites(communityId, req.user.id);
    res.status(200).json(
      invites.map((i) => ({
        id: i.id,
        inviteeId: i.inviteeId,
        invitee: { id: i.invitee.id, nickname: i.invitee.nickname, name: i.invitee.name },
        createdAt: i.createdAt.toISOString(),
      }))
    );
  } catch {
    res.status(500).json({ message: "Erro ao carregar convites" });
  }
}

export async function patchInvite(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const inviteId = req.params.inviteId;
  const action = typeof req.body?.action === "string" ? req.body.action : "";
  if (!inviteId || !["accept", "decline"].includes(action)) {
    res.status(400).json({ message: "inviteId e action (accept|decline) são obrigatórios" });
    return;
  }
  try {
    if (action === "accept") {
      const member = await acceptInvite(inviteId, req.user.id);
      if (!member) {
        res.status(403).json({ message: "Convite inválido ou já processado" });
        return;
      }
      res.status(200).json({ message: "Convite aceito", communityId: member.communityId });
      return;
    }
    const ok = await declineInvite(inviteId, req.user.id);
    if (!ok) {
      res.status(403).json({ message: "Convite inválido ou já processado" });
      return;
    }
    res.status(200).json({ message: "Convite recusado" });
  } catch {
    res.status(500).json({ message: "Erro ao processar convite" });
  }
}

// --- Join requests (private communities) ---

export async function postJoinRequest(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const communityId = req.params.id;
  if (!communityId) {
    res.status(400).json({ message: "ID da comunidade é obrigatório" });
    return;
  }
  try {
    const request = await createJoinRequest(communityId, req.user.id);
    if (!request) {
      res.status(403).json({ message: "Não foi possível solicitar entrada" });
      return;
    }
    res.status(201).json({
      id: request.id,
      communityId: request.communityId,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
    });
  } catch {
    res.status(500).json({ message: "Erro ao solicitar entrada" });
  }
}

export async function getJoinRequests(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const communityId = req.params.id;
  if (!communityId) {
    res.status(400).json({ message: "ID da comunidade é obrigatório" });
    return;
  }
  try {
    const requests = await listJoinRequests(communityId, req.user.id);
    res.status(200).json(
      requests.map((r) => ({
        id: r.id,
        userId: r.userId,
        user: { id: r.user.id, nickname: r.user.nickname, name: r.user.name },
        createdAt: r.createdAt.toISOString(),
      }))
    );
  } catch {
    res.status(500).json({ message: "Erro ao carregar solicitações" });
  }
}

export async function patchJoinRequest(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const communityId = req.params.id;
  const requestId = req.params.requestId;
  const action = typeof req.body?.action === "string" ? req.body.action : "";
  if (!communityId || !requestId || !["approve", "reject"].includes(action)) {
    res.status(400).json({ message: "communityId, requestId e action (approve|reject) são obrigatórios" });
    return;
  }
  try {
    if (action === "approve") {
      const member = await approveJoinRequest(requestId, communityId, req.user.id);
      if (!member) {
        res.status(403).json({ message: "Não foi possível aprovar a solicitação" });
        return;
      }
      res.status(200).json({ message: "Solicitação aprovada" });
      return;
    }
    const ok = await rejectJoinRequest(requestId, communityId, req.user.id);
    if (!ok) {
      res.status(403).json({ message: "Não foi possível rejeitar a solicitação" });
      return;
    }
    res.status(200).json({ message: "Solicitação rejeitada" });
  } catch {
    res.status(500).json({ message: "Erro ao processar solicitação" });
  }
}

export async function getMyPendingJoinRequest(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const communityId = req.params.id;
  if (!communityId) {
    res.status(400).json({ message: "ID da comunidade é obrigatório" });
    return;
  }
  try {
    const request = await getPendingJoinRequest(communityId, req.user.id);
    if (!request || request.status !== "PENDING") {
      res.status(200).json({ pending: false });
      return;
    }
    res.status(200).json({
      pending: true,
      id: request.id,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
    });
  } catch {
    res.status(500).json({ message: "Erro ao verificar solicitação" });
  }
}

export async function patchMemberRole(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const communityId = req.params.id;
  const userId = req.params.userId;
  const role = req.body?.role as CommunityMemberRoleValue | undefined;
  const validRoles: CommunityMemberRoleValue[] = ["MEMBER", "MODERATOR", "ADMIN"];
  if (!communityId || !userId || !role || !validRoles.includes(role)) {
    res.status(400).json({ message: "communityId, userId e role (MEMBER|MODERATOR|ADMIN) são obrigatórios" });
    return;
  }
  try {
    const ok = await updateMemberRole(communityId, userId, req.user.id, role);
    if (!ok) {
      res.status(403).json({ message: "Não foi possível alterar a função do membro" });
      return;
    }
    res.status(200).json({ message: "Função atualizada" });
  } catch {
    res.status(500).json({ message: "Erro ao atualizar função" });
  }
}
