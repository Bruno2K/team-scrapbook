import { prisma } from "../db/client.js";
import type { ScrapReaction } from "@prisma/client";

export async function listScrapsForUser(toUserId: string, limit = 50) {
  return prisma.scrapMessage.findMany({
    where: { toUserId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { from: true },
  });
}

export interface CreateScrapInput {
  fromUserId: string;
  toUserId: string;
  content: string;
  reaction?: ScrapReaction;
}

export async function createScrap(input: CreateScrapInput) {
  return prisma.scrapMessage.create({
    data: {
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      content: input.content,
      reaction: input.reaction,
    },
    include: { from: true },
  });
}
