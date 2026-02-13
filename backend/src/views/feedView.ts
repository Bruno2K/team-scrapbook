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
}

/** User shape from feed/scrap include (subset; team/mainClass may be string from API) */
type UserForFeed = Pick<User, "id" | "name" | "nickname" | "level" | "avatar" | "online"> & {
  team: string;
  mainClass: string;
};
type FeedItemWithUser = PrismaFeedItem & { user: UserForFeed };
type ScrapWithFrom = ScrapMessage & { from: UserForFeed };

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
  return base;
}

export function scrapToFeedItemJSON(scrap: ScrapWithFrom): FeedItemJSON {
  return {
    id: scrap.id,
    user: userToJSON(scrap.from),
    content: scrap.content,
    timestamp: scrap.createdAt.toISOString(),
    type: "scrap",
    reaction: scrap.reaction ?? undefined,
  };
}
