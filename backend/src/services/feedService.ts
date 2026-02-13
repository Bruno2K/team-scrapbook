import { prisma } from "../db/client.js";
import type { FeedType } from "@prisma/client";
import { listScrapsReceived } from "./scrapService.js";

export type FeedEntry =
  | { kind: "feed"; item: Awaited<ReturnType<typeof prisma.feedItem.findMany>>[number] & { user: { id: string; name: string; nickname: string; team: string; mainClass: string; level: number; avatar: string | null; online: boolean } } }
  | { kind: "scrap"; item: Awaited<ReturnType<typeof listScrapsReceived>>[number] };

export async function listFeed(userId?: string, limit = 50): Promise<FeedEntry[]> {
  const [feedItems, scraps] = await Promise.all([
    prisma.feedItem.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: true },
    }),
    userId
      ? listScrapsReceived(userId, limit)
      : Promise.resolve([]),
  ]);

  const entries: FeedEntry[] = [
    ...feedItems.map((item) => ({ kind: "feed" as const, item })),
    ...scraps.map((item) => ({ kind: "scrap" as const, item })),
  ];
  entries.sort((a, b) => {
    const dateA = a.kind === "feed" ? a.item.createdAt : a.item.createdAt;
    const dateB = b.kind === "feed" ? b.item.createdAt : b.item.createdAt;
    return dateB.getTime() - dateA.getTime();
  });
  return entries.slice(0, limit);
}

export interface CreatePostInput {
  userId: string;
  content: string;
  type?: FeedType;
  allowComments?: boolean;
  allowReactions?: boolean;
}

export async function createPost(input: CreatePostInput) {
  return prisma.feedItem.create({
    data: {
      userId: input.userId,
      content: input.content,
      type: input.type ?? "post",
      allowComments: input.allowComments ?? true,
      allowReactions: input.allowReactions ?? true,
    },
    include: { user: true },
  });
}

export async function getFeedItemById(
  feedItemId: string,
  options?: { includeUser: boolean }
) {
  return prisma.feedItem.findUnique({
    where: { id: feedItemId },
    include: {
      user: options?.includeUser !== false,
    },
  });
}
