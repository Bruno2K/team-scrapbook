import { prisma } from "../db/client.js";
import type { FeedType } from "@prisma/client";
import { listScrapsReceived, listScrapsSent } from "./scrapService.js";

type FeedItemWithRelations = Awaited<ReturnType<typeof prisma.feedItem.findMany>>[number] & {
  user: { id: string; name: string; nickname: string; team: string; mainClass: string; level: number; avatar: string | null; online: boolean };
  community?: { id: string; name: string } | null;
};
type ScrapReceived = Awaited<ReturnType<typeof listScrapsReceived>>[number];
type ScrapSent = Awaited<ReturnType<typeof listScrapsSent>>[number];

export type FeedEntry =
  | { kind: "feed"; item: FeedItemWithRelations }
  | { kind: "scrap"; item: ScrapReceived | ScrapSent; direction: "sent" | "received" };

export async function listFeed(userId?: string, limit = 50): Promise<FeedEntry[]> {
  const [feedItems, receivedScraps, sentScraps] = await Promise.all([
    prisma.feedItem.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: true,
        community: { select: { id: true, name: true } },
      },
    }),
    userId ? listScrapsReceived(userId, limit) : Promise.resolve([]),
    userId ? listScrapsSent(userId, limit) : Promise.resolve([]),
  ]);

  const entries: FeedEntry[] = [
    ...feedItems.map((item) => ({ kind: "feed" as const, item })),
    ...receivedScraps.map((item) => ({ kind: "scrap" as const, item, direction: "received" as const })),
    ...sentScraps.map((item) => ({ kind: "scrap" as const, item, direction: "sent" as const })),
  ];
  entries.sort((a, b) => {
    const dateA = a.kind === "feed" ? a.item.createdAt : a.item.createdAt;
    const dateB = b.kind === "feed" ? b.item.createdAt : b.item.createdAt;
    return dateB.getTime() - dateA.getTime();
  });
  return entries.slice(0, limit);
}

export type AttachmentInput = { url: string; type: "image" | "video" | "audio" | "document"; filename?: string };

export interface CreatePostInput {
  userId: string;
  content: string;
  type?: FeedType;
  allowComments?: boolean;
  allowReactions?: boolean;
  attachments?: AttachmentInput[];
}

export async function createPost(input: CreatePostInput) {
  return prisma.feedItem.create({
    data: {
      userId: input.userId,
      content: input.content,
      type: input.type ?? "post",
      allowComments: input.allowComments ?? true,
      allowReactions: input.allowReactions ?? true,
      attachments: (input.attachments?.length ? input.attachments : undefined) as object | undefined,
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

export async function deleteFeedItem(feedItemId: string, userId: string): Promise<boolean> {
  const item = await prisma.feedItem.findUnique({
    where: { id: feedItemId },
    select: { userId: true },
  });
  if (!item || item.userId !== userId) return false;
  await prisma.feedItem.delete({ where: { id: feedItemId } });
  return true;
}
