import { prisma } from "../db/client.js";
import type { TF2Class, Team } from "@prisma/client";

export async function listCommunities(limit = 50) {
  return prisma.community.findMany({
    orderBy: { memberCount: "desc" },
    take: limit,
  });
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

export interface CreateCommunityInput {
  userId: string;
  name: string;
  description: string;
  dominantClass?: TF2Class;
  team?: Team;
}

export async function createCommunity(input: CreateCommunityInput) {
  const { userId, name, description, dominantClass, team } = input;
  return prisma.$transaction(async (tx) => {
    const community = await tx.community.create({
      data: {
        name,
        description,
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

export async function listCommunityPosts(communityId: string, limit = 50) {
  return prisma.feedItem.findMany({
    where: { communityId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: true },
  });
}

export async function createCommunityPost(userId: string, communityId: string, content: string) {
  const member = await getMember(userId, communityId);
  if (!member) return null;
  return prisma.feedItem.create({
    data: {
      userId,
      communityId,
      content,
      type: "community",
    },
    include: { user: true },
  });
}
