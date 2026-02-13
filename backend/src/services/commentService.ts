import { prisma } from "../db/client.js";

/** Batch: total comment count per feed item (including replies). */
export async function getCommentCountByFeedItemIds(
  feedItemIds: string[]
): Promise<Record<string, number>> {
  if (feedItemIds.length === 0) return {};
  const rows = await prisma.postComment.groupBy({
    by: ["feedItemId"],
    where: { feedItemId: { in: feedItemIds } },
    _count: { id: true },
  });
  const result: Record<string, number> = {};
  for (const id of feedItemIds) result[id] = 0;
  for (const r of rows) {
    if (r.feedItemId) result[r.feedItemId] = r._count.id;
  }
  return result;
}

/** Batch: total comment count per scrap (including replies). */
export async function getCommentCountByScrapIds(
  scrapIds: string[]
): Promise<Record<string, number>> {
  if (scrapIds.length === 0) return {};
  const rows = await prisma.postComment.groupBy({
    by: ["scrapId"],
    where: { scrapId: { in: scrapIds } },
    _count: { id: true },
  });
  const result: Record<string, number> = {};
  for (const id of scrapIds) result[id] = 0;
  for (const r of rows) {
    if (r.scrapId) result[r.scrapId] = r._count.id;
  }
  return result;
}

export async function listCommentsByFeedItemId(feedItemId: string) {
  const comments = await prisma.postComment.findMany({
    where: { feedItemId },
    include: {
      user: true,
      reactions: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const byId = new Map(comments.map((c) => [c.id, { ...c, replies: [] as typeof comments }]));
  const roots: typeof comments = [];

  for (const c of comments) {
    const node = byId.get(c.id)!;
    if (c.parentId == null) {
      roots.push(node);
    } else {
      const parent = byId.get(c.parentId);
      if (parent) (parent as { replies: typeof comments }).replies.push(node);
      else roots.push(node);
    }
  }

  return roots;
}

export async function listCommentsByScrapId(scrapId: string) {
  const comments = await prisma.postComment.findMany({
    where: { scrapId },
    include: {
      user: true,
      reactions: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const byId = new Map(comments.map((c) => [c.id, { ...c, replies: [] as typeof comments }]));
  const roots: typeof comments = [];

  for (const c of comments) {
    const node = byId.get(c.id)!;
    if (c.parentId == null) {
      roots.push(node);
    } else {
      const parent = byId.get(c.parentId);
      if (parent) (parent as { replies: typeof comments }).replies.push(node);
      else roots.push(node);
    }
  }

  return roots;
}

export async function createComment(
  userId: string,
  feedItemId: string | null,
  content: string,
  parentId?: string | null,
  scrapId?: string | null
) {
  // Verificar se é FeedItem ou Scrap
  if (feedItemId) {
    const feedItem = await prisma.feedItem.findUnique({
      where: { id: feedItemId },
      select: { allowComments: true },
    });
    if (!feedItem) return null;
    if (!feedItem.allowComments) return "disabled";

    if (parentId != null) {
      const parent = await prisma.postComment.findFirst({
        where: { id: parentId, feedItemId },
      });
      if (!parent) return null;
    }

    return prisma.postComment.create({
      data: {
        userId,
        feedItemId,
        content: content.trim(),
        parentId: parentId || null,
      },
      include: { user: true, reactions: true },
    });
  } else if (scrapId) {
    // Verificar se o scrap existe e se o usuário tem acesso
    const scrap = await prisma.scrapMessage.findUnique({
      where: { id: scrapId },
      select: { fromUserId: true, toUserId: true },
    });
    if (!scrap) return null;
    // Ambos (remetente e destinatário) podem comentar
    if (scrap.fromUserId !== userId && scrap.toUserId !== userId) return null;

    if (parentId != null) {
      const parent = await prisma.postComment.findFirst({
        where: { id: parentId, scrapId },
      });
      if (!parent) return null;
    }

    return prisma.postComment.create({
      data: {
        userId,
        scrapId,
        content: content.trim(),
        parentId: parentId || null,
      },
      include: { user: true, reactions: true },
    });
  }
  return null;
}

export async function deleteComment(commentId: string, userId: string): Promise<boolean> {
  const comment = await prisma.postComment.findUnique({
    where: { id: commentId },
    select: { userId: true },
  });
  if (!comment || comment.userId !== userId) return false;
  await prisma.postComment.delete({ where: { id: commentId } });
  return true;
}
