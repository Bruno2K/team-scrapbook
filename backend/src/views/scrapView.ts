import type { ScrapMessage as PrismaScrap } from "@prisma/client";
import type { User } from "@prisma/client";
import { userToJSON, type UserJSON } from "./userView.js";
import type { AttachmentJSON } from "./feedView.js";

export type ScrapReaction = "headshot" | "heal" | "burn" | "backstab";

export type ScrapDirection = "sent" | "received";

export interface ScrapMessageJSON {
  id: string;
  from: UserJSON;
  to?: UserJSON;
  content: string;
  timestamp: string;
  reaction?: ScrapReaction;
  direction?: ScrapDirection;
  attachments?: AttachmentJSON[];
}

type ScrapWithFrom = PrismaScrap & { from: User };
type ScrapWithFromAndTo = PrismaScrap & { from: User; to: User };

export function scrapToJSON(
  scrap: ScrapWithFrom | ScrapWithFromAndTo,
  direction?: ScrapDirection
): ScrapMessageJSON {
  const base = {
    id: scrap.id,
    from: userToJSON(scrap.from),
    content: scrap.content,
    timestamp: scrap.createdAt.toISOString(),
    reaction: scrap.reaction as ScrapReaction | undefined,
    ...(direction ? { direction } : {}),
    ...(scrap.attachments != null && Array.isArray(scrap.attachments)
      ? { attachments: scrap.attachments as unknown as AttachmentJSON[] }
      : {}),
  };
  if (direction === "sent" && "to" in scrap && scrap.to) {
    return { ...base, to: userToJSON(scrap.to) };
  }
  return base;
}
