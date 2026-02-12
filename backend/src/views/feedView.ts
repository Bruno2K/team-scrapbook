import type { FeedItem as PrismaFeedItem } from "@prisma/client";
import type { User } from "@prisma/client";
import { userToJSON, type UserJSON } from "./userView.js";

export type FeedType = "post" | "achievement" | "community" | "scrap";

export interface FeedItemJSON {
  id: string;
  user: UserJSON;
  content: string;
  timestamp: string;
  type: FeedType;
}

type FeedItemWithUser = PrismaFeedItem & { user: User };

export function feedItemToJSON(item: FeedItemWithUser): FeedItemJSON {
  return {
    id: item.id,
    user: userToJSON(item.user),
    content: item.content,
    timestamp: item.createdAt.toISOString(),
    type: item.type as FeedType,
  };
}
