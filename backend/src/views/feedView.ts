import type { FeedItem as PrismaFeedItem, ScrapMessage, User } from "@prisma/client";
import { userToJSON, type UserJSON } from "./userView.js";

export type FeedType = "post" | "achievement" | "community" | "scrap";

export interface ReactionCountsJSON {
  headshot: number;
  heal: number;
  burn: number;
  backstab: number;
}

export interface FeedItemJSON {
  id: string;
  user: UserJSON;
  content: string;
  timestamp: string;
  type: FeedType;
  /** Present when type is "scrap": reaction from sender */
  reaction?: string;
  allowComments?: boolean;
  allowReactions?: boolean;
  reactionCounts?: ReactionCountsJSON;
  myReaction?: string;
  /** Total number of comments (including replies) */
  commentCount?: number;
  /** Present when type is "community": which community the post belongs to */
  community?: { id: string; name: string };
  /** Present when type is "scrap": whether current user sent or received it */
  scrapDirection?: "sent" | "received";
  /** Present when type is "scrap" and scrapDirection is "sent": recipient */
  scrapTo?: UserJSON;
  /** Media attachments (images, video, audio, documents) */
  attachments?: AttachmentJSON[];
}

export interface AttachmentJSON {
  url: string;
  type: "image" | "video" | "audio" | "document";
  filename?: string;
}

/** User shape from feed/scrap include (subset; team/mainClass may be string from API) */
type UserForFeed = Pick<User, "id" | "name" | "nickname" | "level" | "avatar" | "online"> & {
  team: string;
  mainClass: string;
};
type FeedItemWithUser = PrismaFeedItem & {
  user: UserForFeed;
  community?: { id: string; name: string } | null;
};
type ScrapWithFrom = ScrapMessage & { from: UserForFeed };
type ScrapWithFromTo = ScrapMessage & { from: UserForFeed; to: UserForFeed };

export function feedItemToJSON(
  item: FeedItemWithUser,
  options?: {
    reactionCounts?: ReactionCountsJSON;
    myReaction?: string;
    commentCount?: number;
  }
): FeedItemJSON {
  const base: FeedItemJSON = {
    id: item.id,
    user: userToJSON(item.user),
    content: item.content,
    timestamp: item.createdAt.toISOString(),
    type: item.type as FeedType,
  };
  if ("allowComments" in item && item.allowComments !== undefined)
    base.allowComments = item.allowComments;
  if ("allowReactions" in item && item.allowReactions !== undefined)
    base.allowReactions = item.allowReactions;
  if (options?.reactionCounts) base.reactionCounts = options.reactionCounts;
  if (options?.myReaction) base.myReaction = options.myReaction;
  if (options?.commentCount !== undefined) base.commentCount = options.commentCount;
  if (item.community) base.community = { id: item.community.id, name: item.community.name };
  if (item.attachments != null && Array.isArray(item.attachments))
    base.attachments = item.attachments as unknown as AttachmentJSON[];
  return base;
}

export function scrapToFeedItemJSON(
  scrap: ScrapWithFrom | ScrapWithFromTo,
  options?: {
    direction?: "sent" | "received";
    toUser?: UserJSON;
    reactionCounts?: ReactionCountsJSON;
    myReaction?: string;
    commentCount?: number;
  }
): FeedItemJSON {
  const base: FeedItemJSON = {
    id: scrap.id,
    user: userToJSON(scrap.from),
    content: scrap.content,
    timestamp: scrap.createdAt.toISOString(),
    type: "scrap",
    reaction: scrap.reaction ?? undefined,
    allowReactions: true, // Scraps sempre permitem reações
    allowComments: true, // Scraps agora têm comentários
  };
  if (options?.direction) base.scrapDirection = options.direction;
  if (options?.toUser) base.scrapTo = options.toUser;
  if (options?.reactionCounts) base.reactionCounts = options.reactionCounts;
  if (options?.myReaction) base.myReaction = options.myReaction;
  if (options?.commentCount !== undefined) base.commentCount = options.commentCount;
  if (scrap.attachments != null && Array.isArray(scrap.attachments))
    base.attachments = scrap.attachments as unknown as AttachmentJSON[];
  return base;
}
