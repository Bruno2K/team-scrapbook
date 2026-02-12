import type { ScrapMessage as PrismaScrap } from "@prisma/client";
import type { User } from "@prisma/client";
import { userToJSON, type UserJSON } from "./userView.js";

export type ScrapReaction = "headshot" | "heal" | "burn" | "backstab";

export interface ScrapMessageJSON {
  id: string;
  from: UserJSON;
  content: string;
  timestamp: string;
  reaction?: ScrapReaction;
}

type ScrapWithFrom = PrismaScrap & { from: User };

export function scrapToJSON(scrap: ScrapWithFrom): ScrapMessageJSON {
  return {
    id: scrap.id,
    from: userToJSON(scrap.from),
    content: scrap.content,
    timestamp: scrap.createdAt.toISOString(),
    reaction: scrap.reaction as ScrapReaction | undefined,
  };
}
