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
  for (const r of rows) result[r.feedItemId] = r._count.id;
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

export async function createComment(
  userId: string,
  feedItemId: string,
  content: string,
  parentId?: string | null
) {
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
