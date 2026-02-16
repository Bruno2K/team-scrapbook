import { prisma } from "../db/client.js";
import type { FeedType } from "@prisma/client";
import { listScrapsReceived, listScrapsSent } from "./scrapService.js";
import { canModerateCommunity } from "./communityService.js";

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

/** Only feed items (posts) by this user, no scraps. */
export async function listFeedByUserId(
  userId: string,
  limit = 50
): Promise<FeedItemWithRelations[]> {
  return prisma.feedItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: true,
      community: { select: { id: true, name: true } },
    },
  });
}

/** Profile feed: my posts + scraps I sent or received, merged and sorted by date. */
export async function listMyProfileFeed(
  userId: string,
  limit = 50
): Promise<FeedEntry[]> {
  const [feedItems, receivedScraps, sentScraps] = await Promise.all([
    prisma.feedItem.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: true,
        community: { select: { id: true, name: true } },
      },
    }),
    listScrapsReceived(userId, limit),
    listScrapsSent(userId, limit),
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
    select: { userId: true, communityId: true },
  });
  if (!item) return false;
  if (item.userId === userId) {
    await prisma.feedItem.delete({ where: { id: feedItemId } });
    return true;
  }
  if (item.communityId) {
    const canMod = await canModerateCommunity(userId, item.communityId);
    if (canMod) {
      await prisma.feedItem.delete({ where: { id: feedItemId } });
      return true;
    }
  }
  return false;
}

export interface UserMediaItem {
  url: string;
  type: string;
  filename?: string;
  feedItemId?: string;
  scrapId?: string;
  createdAt: Date;
}

/** All media attachments from a user's feed items and scraps (sent or received), sorted by date desc. */
export async function listUserMedia(userId: string, limit = 100): Promise<UserMediaItem[]> {
  const [feedItems, scraps] = await Promise.all([
    prisma.feedItem.findMany({
      where: { userId, attachments: { not: null } },
      orderBy: { createdAt: "desc" },
      take: limit * 2,
      select: { id: true, attachments: true, createdAt: true },
    }),
    prisma.scrapMessage.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
        attachments: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: limit * 2,
      select: { id: true, attachments: true, createdAt: true },
    }),
  ]);

  const items: UserMediaItem[] = [];
  const parseAttachments = (raw: unknown, opts: { feedItemId?: string; scrapId?: string; createdAt: Date }) => {
    const arr = Array.isArray(raw) ? raw : [];
    for (const a of arr) {
      if (a && typeof a === "object" && typeof (a as { url?: string }).url === "string") {
        const att = a as { url: string; type?: string; filename?: string };
        items.push({
          url: att.url,
          type: typeof att.type === "string" ? att.type : "image",
          filename: typeof att.filename === "string" ? att.filename : undefined,
          feedItemId: opts.feedItemId,
          scrapId: opts.scrapId,
          createdAt: opts.createdAt,
        });
      }
    }
  };

  for (const row of feedItems) {
    if (row.attachments) parseAttachments(row.attachments, { feedItemId: row.id, createdAt: row.createdAt });
  }
  for (const row of scraps) {
    if (row.attachments) parseAttachments(row.attachments, { scrapId: row.id, createdAt: row.createdAt });
  }

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return items.slice(0, limit);
}
