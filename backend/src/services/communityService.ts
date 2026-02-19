import { prisma } from "../db/client.js";
import type { TF2Class, Team } from "@prisma/client";
import type { User } from "@prisma/client";
import { listFriends } from "./userService.js";
import { createNotification, deleteByJoinRequestId } from "./notificationService.js";

export interface ListCommunitiesOptions {
  userId?: string;
  search?: string;
  limit?: number;
}

export interface CommunityWithMeta {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  isPrivate: boolean;
  dominantClass: TF2Class | null;
  team: Team | null;
  ownerId: string | null;
  isMember: boolean;
  friendsInCommunity: User[];
}

/** Get friends of userId who are members of communityId. */
export async function getFriendsInCommunity(userId: string, communityId: string): Promise<User[]> {
  const friendIds = new Set((await listFriends(userId)).map((u) => u.id));
  const members = await listCommunityMembers(communityId);
  return members.filter((m) => friendIds.has(m.userId)).map((m) => m.user);
}

export async function listCommunities(limit?: number): Promise<Awaited<ReturnType<typeof prisma.community.findMany>>>;
export async function listCommunities(options: ListCommunitiesOptions): Promise<CommunityWithMeta[]>;
export async function listCommunities(
  limitOrOptions: number | ListCommunitiesOptions = 50
): Promise<CommunityWithMeta[] | Awaited<ReturnType<typeof prisma.community.findMany>>> {
  const options: ListCommunitiesOptions = typeof limitOrOptions === "object" ? limitOrOptions : { limit: limitOrOptions ?? 50 };
  const { userId, search, limit = 50 } = options;

  const searchTerm = search?.trim();
  const where = searchTerm
    ? {
        OR: [
          { name: { contains: searchTerm } },
          { description: { contains: searchTerm } },
        ],
      }
    : undefined;

  const communities = await prisma.community.findMany({
    where,
    orderBy: { memberCount: "desc" },
    take: limit,
  });

  if (!userId) {
    return communities;
  }

  const result: CommunityWithMeta[] = await Promise.all(
    communities.map(async (c) => {
      const [membership, friendsInCommunity] = await Promise.all([
        getMember(userId, c.id),
        getFriendsInCommunity(userId, c.id),
      ]);
      return {
        id: c.id,
        name: c.name,
        description: c.description,
        memberCount: c.memberCount,
        isPrivate: c.isPrivate,
        dominantClass: c.dominantClass,
        team: c.team,
        ownerId: c.ownerId,
        isMember: !!membership,
        friendsInCommunity,
      };
    })
  );
  return result;
}

/** Communities where the user is a member (e.g. for sidebar). */
export async function listCommunitiesWhereMember(userId: string, limit = 50): Promise<CommunityWithMeta[]> {
  const memberRows = await prisma.communityMember.findMany({
    where: { userId },
    include: { community: true },
    orderBy: { joinedAt: "asc" },
    take: limit,
  });
  const communities = memberRows.map((r) => r.community);
  const result: CommunityWithMeta[] = await Promise.all(
    communities.map(async (c) => {
      const friendsInCommunity = await getFriendsInCommunity(userId, c.id);
      return {
        id: c.id,
        name: c.name,
        description: c.description,
        memberCount: c.memberCount,
        isPrivate: c.isPrivate,
        dominantClass: c.dominantClass,
        team: c.team,
        ownerId: c.ownerId,
        isMember: true,
        friendsInCommunity,
      };
    })
  );
  return result;
}

/** Recommended: communities where user is NOT a member but has friends in them. Ordered by friend count. */
export async function listRecommendedCommunities(userId: string, limit = 20): Promise<CommunityWithMeta[]> {
  const all = await listCommunities({ userId, limit: 200 });
  const notMember = all.filter((c) => !c.isMember && c.friendsInCommunity.length > 0);
  notMember.sort((a, b) => b.friendsInCommunity.length - a.friendsInCommunity.length);
  return notMember.slice(0, limit);
}

export async function getCommunityById(id: string) {
  return prisma.community.findUnique({
    where: { id },
    include: { owner: true, members: { include: { user: true } } },
  });
}

export async function getMember(userId: string, communityId: string) {
  return prisma.communityMember.findUnique({
    where: { userId_communityId: { userId, communityId } },
  });
}

export async function canManageCommunity(userId: string, communityId: string): Promise<boolean> {
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { ownerId: true },
  });
  if (!community) return false;
  if (community.ownerId === userId) return true;
  const member = await getMember(userId, communityId);
  return member?.role === "ADMIN";
}

export async function canModerateCommunity(userId: string, communityId: string): Promise<boolean> {
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { ownerId: true },
  });
  if (!community) return false;
  if (community.ownerId === userId) return true;
  const member = await getMember(userId, communityId);
  return member?.role === "ADMIN" || member?.role === "MODERATOR";
}

export interface CreateCommunityInput {
  userId: string;
  name: string;
  description: string;
  isPrivate?: boolean;
  dominantClass?: TF2Class;
  team?: Team;
}

export async function createCommunity(input: CreateCommunityInput) {
  const { userId, name, description, isPrivate = false, dominantClass, team } = input;
  return prisma.$transaction(async (tx) => {
    const community = await tx.community.create({
      data: {
        name,
        description,
        isPrivate: !!isPrivate,
        dominantClass,
        team,
        ownerId: userId,
        memberCount: 1,
      },
    });
    await tx.communityMember.create({
      data: {
        userId,
        communityId: community.id,
        role: "ADMIN",
      },
    });
    return prisma.community.findUnique({
      where: { id: community.id },
      include: { owner: true },
    });
  });
}

export interface UpdateCommunityInput {
  name?: string;
  description?: string;
  isPrivate?: boolean;
  dominantClass?: TF2Class | null;
  team?: Team | null;
}

export async function updateCommunity(communityId: string, data: UpdateCommunityInput) {
  return prisma.community.update({
    where: { id: communityId },
    data,
  });
}

export async function deleteCommunity(communityId: string) {
  return prisma.community.delete({
    where: { id: communityId },
  });
}

export async function joinCommunity(userId: string, communityId: string) {
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { isPrivate: true },
  });
  if (!community) return null;
  if (community.isPrivate) {
    const err = new Error("Comunidade privada; solicite entrada ou aguarde convite.");
    (err as Error & { code?: string }).code = "COMMUNITY_PRIVATE";
    throw err;
  }
  const existing = await getMember(userId, communityId);
  if (existing) return existing;
  return prisma.$transaction(async (tx) => {
    await tx.communityMember.create({
      data: { userId, communityId, role: "MEMBER" },
    });
    await tx.community.update({
      where: { id: communityId },
      data: { memberCount: { increment: 1 } },
    });
    return getMember(userId, communityId);
  });
}

export async function leaveCommunity(userId: string, communityId: string) {
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { ownerId: true },
  });
  if (community?.ownerId === userId) return false;
  const deleted = await prisma.$transaction(async (tx) => {
    const r = await tx.communityMember.deleteMany({
      where: { userId, communityId },
    });
    if (r.count > 0) {
      await tx.community.update({
        where: { id: communityId },
        data: { memberCount: { decrement: 1 } },
      });
    }
    return r.count;
  });
  return deleted > 0;
}

export async function listCommunityMembers(communityId: string) {
  return prisma.communityMember.findMany({
    where: { communityId },
    include: { user: true },
    orderBy: [{ role: "desc" }, { joinedAt: "asc" }],
  });
}

/** Communities with the most posts in the last N hours (default: 24). */
export async function listHypeCommunities(options: {
  userId?: string;
  limit?: number;
  sinceHours?: number;
} = {}): Promise<CommunityWithMeta[]> {
  const { userId, limit = 20, sinceHours = 24 } = options;
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

  // Group feed items by community in the given time window
  const grouped = await prisma.feedItem.groupBy({
    where: {
      communityId: { not: null },
      createdAt: { gte: since },
    },
    by: ["communityId"],
    _count: { id: true },
  });

  // Sort by count descending and take top N
  const sorted = grouped
    .filter((g) => g.communityId !== null)
    .sort((a, b) => (b._count.id ?? 0) - (a._count.id ?? 0))
    .slice(0, limit);

  const communityIds = sorted
    .map((g) => g.communityId)
    .filter((id): id is string => Boolean(id));

  if (communityIds.length === 0) {
    return [];
  }

  const communities = await prisma.community.findMany({
    where: { id: { in: communityIds } },
  });

  const byId = new Map(communities.map((c) => [c.id, c]));

  const raw = await Promise.all(
    communityIds.map(async (id) => {
      const c = byId.get(id);
      if (!c) return null;

      if (userId) {
        const [membership, friendsInCommunity] = await Promise.all([
          getMember(userId, c.id),
          getFriendsInCommunity(userId, c.id),
        ]);
        return {
          id: c.id,
          name: c.name,
          description: c.description,
          memberCount: c.memberCount,
          isPrivate: c.isPrivate,
          dominantClass: c.dominantClass,
          team: c.team,
          ownerId: c.ownerId,
          isMember: !!membership,
          friendsInCommunity,
        };
      }

      return {
        id: c.id,
        name: c.name,
        description: c.description,
        memberCount: c.memberCount,
        isPrivate: c.isPrivate,
        dominantClass: c.dominantClass,
        team: c.team,
        ownerId: c.ownerId,
        isMember: false,
        friendsInCommunity: [],
      };
    })
  );

  // Filter out any nulls (shouldn't normally happen) while preserving order by hype
  return raw.filter((c): c is CommunityWithMeta => c !== null);
}

export async function removeMember(communityId: string, targetUserId: string, actorUserId: string): Promise<boolean> {
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { ownerId: true },
  });
  if (!community) return false;
  if (community.ownerId === targetUserId) return false;
  const canManage = await canManageCommunity(actorUserId, communityId);
  if (!canManage) return false;
  const target = await getMember(targetUserId, communityId);
  if (!target) return false;
  if (target.role === "ADMIN" && community.ownerId !== actorUserId) return false;
  const r = await prisma.$transaction(async (tx) => {
    const deleted = await tx.communityMember.deleteMany({
      where: { userId: targetUserId, communityId },
    });
    if (deleted.count > 0) {
      await tx.community.update({
        where: { id: communityId },
        data: { memberCount: { decrement: 1 } },
      });
    }
    return deleted.count;
  });
  return r > 0;
}

export type CommunityMemberRoleValue = "MEMBER" | "MODERATOR" | "ADMIN";

export async function updateMemberRole(
  communityId: string,
  targetUserId: string,
  actorUserId: string,
  newRole: CommunityMemberRoleValue
): Promise<boolean> {
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { ownerId: true },
  });
  if (!community) return false;
  if (community.ownerId === targetUserId) return false; // cannot change owner's role
  const canManage = await canManageCommunity(actorUserId, communityId);
  if (!canManage) return false;
  const target = await getMember(targetUserId, communityId);
  if (!target) return false;
  if (target.role === "ADMIN" && community.ownerId !== actorUserId) return false; // only owner can change another admin
  await prisma.communityMember.update({
    where: { userId_communityId: { userId: targetUserId, communityId } },
    data: { role: newRole },
  });
  return true;
}

export async function listCommunityPosts(communityId: string, limit = 50) {
  return prisma.feedItem.findMany({
    where: { communityId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: true },
  });
}

export type AttachmentInput = { url: string; type: "image" | "video" | "audio" | "document"; filename?: string };

export interface CreateCommunityPostInput {
  content: string;
  allowComments?: boolean;
  allowReactions?: boolean;
  attachments?: AttachmentInput[];
}

export async function createCommunityPost(
  userId: string,
  communityId: string,
  input: CreateCommunityPostInput
) {
  const member = await getMember(userId, communityId);
  if (!member) return null;
  return prisma.feedItem.create({
    data: {
      userId,
      communityId,
      content: input.content,
      type: "community",
      allowComments: input.allowComments ?? true,
      allowReactions: input.allowReactions ?? true,
      attachments: (input.attachments?.length ? input.attachments : undefined) as object | undefined,
    },
    include: { user: true },
  });
}

// --- Community invites (private communities: only admins can invite) ---

export async function createInvite(communityId: string, inviterId: string, inviteeId: string) {
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { isPrivate: true },
  });
  if (!community?.isPrivate) return null;
  const canManage = await canManageCommunity(inviterId, communityId);
  if (!canManage) return null;
  const existingMember = await getMember(inviteeId, communityId);
  if (existingMember) return null;
  const existing = await prisma.communityInvite.findUnique({
    where: { communityId_inviteeId: { communityId, inviteeId } },
  });
  if (existing && existing.status === "PENDING") return existing;
  if (existing && existing.status !== "PENDING") {
    const invite = await prisma.communityInvite.update({
      where: { id: existing.id },
      data: { status: "PENDING" },
      include: { community: true, inviter: true, invitee: true },
    });
    await createNotification({
      userId: inviteeId,
      type: "COMMUNITY_INVITE",
      payload: { inviteId: invite.id, communityId },
    });
    return invite;
  }
  const invite = await prisma.communityInvite.create({
    data: { communityId, inviterId, inviteeId, status: "PENDING" },
    include: { community: true, inviter: true, invitee: true },
  });
  await createNotification({
    userId: inviteeId,
    type: "COMMUNITY_INVITE",
    payload: { inviteId: invite.id, communityId },
  });
  return invite;
}

export async function listPendingInvitesForUser(userId: string) {
  return prisma.communityInvite.findMany({
    where: { inviteeId: userId, status: "PENDING" },
    include: { community: true, inviter: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function acceptInvite(inviteId: string, userId: string) {
  const invite = await prisma.communityInvite.findUnique({
    where: { id: inviteId },
    include: { community: true },
  });
  if (!invite || invite.inviteeId !== userId || invite.status !== "PENDING") return null;
  const joined = await prisma.$transaction(async (tx) => {
    await tx.communityMember.create({
      data: { userId: invite.inviteeId, communityId: invite.communityId, role: "MEMBER" },
    });
    await tx.community.update({
      where: { id: invite.communityId },
      data: { memberCount: { increment: 1 } },
    });
    await tx.communityInvite.update({
      where: { id: inviteId },
      data: { status: "ACCEPTED" },
    });
    return getMember(userId, invite.communityId);
  });
  return joined;
}

export async function declineInvite(inviteId: string, userId: string) {
  const invite = await prisma.communityInvite.findUnique({
    where: { id: inviteId },
  });
  if (!invite || invite.inviteeId !== userId || invite.status !== "PENDING") return false;
  await prisma.communityInvite.update({
    where: { id: inviteId },
    data: { status: "DECLINED" },
  });
  return true;
}

export async function listCommunityInvites(communityId: string, actorUserId: string) {
  const canManage = await canManageCommunity(actorUserId, communityId);
  if (!canManage) return [];
  return prisma.communityInvite.findMany({
    where: { communityId, status: "PENDING" },
    include: { invitee: true, inviter: true },
    orderBy: { createdAt: "desc" },
  });
}

// --- Community join requests (private: user requests; admin approves) ---

export async function createJoinRequest(communityId: string, userId: string) {
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { isPrivate: true, ownerId: true },
  });
  if (!community?.isPrivate) return null;
  const existingMember = await getMember(userId, communityId);
  if (existingMember) return null;
  const existing = await prisma.communityJoinRequest.findUnique({
    where: { communityId_userId: { communityId, userId } },
  });
  let request: Awaited<ReturnType<typeof prisma.communityJoinRequest.create>> & { community: { id: string }; user: { id: string } };
  if (existing) {
    if (existing.status === "PENDING") return existing;
    request = await prisma.communityJoinRequest.update({
      where: { id: existing.id },
      data: { status: "PENDING", reviewedById: null, reviewedAt: null },
      include: { community: true, user: true },
    });
  } else {
    request = await prisma.communityJoinRequest.create({
      data: { communityId, userId, status: "PENDING" },
      include: { community: true, user: true },
    });
  }
  const members = await listCommunityMembers(communityId);
  const adminIds = new Set<string>();
  if (community.ownerId) adminIds.add(community.ownerId);
  members.filter((m) => m.role === "ADMIN").forEach((m) => adminIds.add(m.userId));
  for (const adminId of adminIds) {
    await createNotification({
      userId: adminId,
      type: "COMMUNITY_JOIN_REQUEST",
      payload: { joinRequestId: request.id, communityId, userId: request.userId },
    });
  }
  return request;
}

export async function listJoinRequests(communityId: string, actorUserId: string) {
  const canManage = await canManageCommunity(actorUserId, communityId);
  if (!canManage) return [];
  return prisma.communityJoinRequest.findMany({
    where: { communityId, status: "PENDING" },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPendingJoinRequest(communityId: string, userId: string) {
  return prisma.communityJoinRequest.findUnique({
    where: { communityId_userId: { communityId, userId } },
  });
}

export async function approveJoinRequest(requestId: string, communityId: string, actorUserId: string) {
  const canManage = await canManageCommunity(actorUserId, communityId);
  if (!canManage) return null;
  const request = await prisma.communityJoinRequest.findUnique({
    where: { id: requestId },
    include: { community: true },
  });
  if (!request || request.communityId !== communityId || request.status !== "PENDING") return null;
  await prisma.$transaction(async (tx) => {
    await tx.communityMember.create({
      data: { userId: request.userId, communityId: request.communityId, role: "MEMBER" },
    });
    await tx.community.update({
      where: { id: request.communityId },
      data: { memberCount: { increment: 1 } },
    });
    await tx.communityJoinRequest.update({
      where: { id: requestId },
      data: { status: "APPROVED", reviewedById: actorUserId, reviewedAt: new Date() },
    });
  });
  await deleteByJoinRequestId(requestId);
  return getMember(request.userId, communityId);
}

export async function rejectJoinRequest(requestId: string, communityId: string, actorUserId: string) {
  const canManage = await canManageCommunity(actorUserId, communityId);
  if (!canManage) return false;
  const request = await prisma.communityJoinRequest.findUnique({
    where: { id: requestId },
  });
  if (!request || request.communityId !== communityId || request.status !== "PENDING") return false;
  await prisma.communityJoinRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED", reviewedById: actorUserId, reviewedAt: new Date() },
  });
  return true;
}
