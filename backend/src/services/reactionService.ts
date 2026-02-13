import type { ScrapReaction } from "@prisma/client";
import { prisma } from "../db/client.js";

const REACTIONS: ScrapReaction[] = ["headshot", "heal", "burn", "backstab"];

function emptyCounts() {
  return { headshot: 0, heal: 0, burn: 0, backstab: 0 };
}

export function getPostReactionCounts(feedItemId: string): Promise<Record<ScrapReaction, number>> {
  return prisma.feedItemReaction
    .groupBy({
      by: ["reaction"],
      where: { feedItemId },
      _count: { reaction: true },
    })
    .then((groups) => {
      const counts = { ...emptyCounts() };
      for (const g of groups) counts[g.reaction] = g._count.reaction;
      return counts as Record<ScrapReaction, number>;
    });
}

export function getMyPostReaction(feedItemId: string, userId: string): Promise<ScrapReaction | null> {
  return prisma.feedItemReaction
    .findUnique({
      where: { feedItemId_userId: { feedItemId, userId } },
      select: { reaction: true },
    })
    .then((r) => r?.reaction ?? null);
}

/** Batch: reaction counts per feed item (for list feed). */
export async function getPostReactionCountsForMany(
  feedItemIds: string[]
): Promise<Record<string, Record<ScrapReaction, number>>> {
  if (feedItemIds.length === 0) return {};
  const rows = await prisma.feedItemReaction.groupBy({
    by: ["feedItemId", "reaction"],
    where: { feedItemId: { in: feedItemIds } },
    _count: { reaction: true },
  });
  const result: Record<string, Record<ScrapReaction, number>> = {};
  for (const id of feedItemIds) result[id] = { ...emptyCounts() };
  for (const r of rows) {
    if (result[r.feedItemId]) result[r.feedItemId][r.reaction as ScrapReaction] = r._count.reaction;
  }
  return result;
}

/** Batch: current user's reaction per feed item (for list feed). */
export async function getMyPostReactionsForMany(
  feedItemIds: string[],
  userId: string
): Promise<Record<string, ScrapReaction>> {
  if (feedItemIds.length === 0) return {};
  const list = await prisma.feedItemReaction.findMany({
    where: { feedItemId: { in: feedItemIds }, userId },
    select: { feedItemId: true, reaction: true },
  });
  const result: Record<string, ScrapReaction> = {};
  for (const r of list) result[r.feedItemId] = r.reaction;
  return result;
}

export async function setPostReaction(
  feedItemId: string,
  userId: string,
  reaction: ScrapReaction
): Promise<boolean> {
  const feedItem = await prisma.feedItem.findUnique({
    where: { id: feedItemId },
    select: { allowReactions: true },
  });
  if (!feedItem || !feedItem.allowReactions) return false;
  if (!REACTIONS.includes(reaction)) return false;

  await prisma.feedItemReaction.upsert({
    where: { feedItemId_userId: { feedItemId, userId } },
    create: { feedItemId, userId, reaction },
    update: { reaction },
  });
  return true;
}

export async function removePostReaction(feedItemId: string, userId: string): Promise<boolean> {
  const deleted = await prisma.feedItemReaction.deleteMany({
    where: { feedItemId, userId },
  });
  return deleted.count > 0;
}

export function getCommentReactionCounts(commentId: string): Promise<Record<ScrapReaction, number>> {
  return prisma.commentReaction
    .groupBy({
      by: ["reaction"],
      where: { commentId },
      _count: { reaction: true },
    })
    .then((groups) => {
      const counts = { ...emptyCounts() };
      for (const g of groups) counts[g.reaction] = g._count.reaction;
      return counts as Record<ScrapReaction, number>;
    });
}

export function getMyCommentReaction(commentId: string, userId: string): Promise<ScrapReaction | null> {
  return prisma.commentReaction
    .findUnique({
      where: { commentId_userId: { commentId, userId } },
      select: { reaction: true },
    })
    .then((r) => r?.reaction ?? null);
}

export async function setCommentReaction(
  commentId: string,
  userId: string,
  reaction: ScrapReaction
): Promise<boolean> {
  if (!REACTIONS.includes(reaction)) return false;
  await prisma.commentReaction.upsert({
    where: { commentId_userId: { commentId, userId } },
    create: { commentId, userId, reaction },
    update: { reaction },
  });
  return true;
}

export async function removeCommentReaction(commentId: string, userId: string): Promise<boolean> {
  const deleted = await prisma.commentReaction.deleteMany({
    where: { commentId, userId },
  });
  return deleted.count > 0;
}
