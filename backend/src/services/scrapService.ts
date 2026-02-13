import { prisma } from "../db/client.js";
import type { ScrapReaction } from "@prisma/client";

export async function listScrapsReceived(toUserId: string, limit = 50) {
  return prisma.scrapMessage.findMany({
    where: { toUserId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { from: true },
  });
}

export async function listScrapsSent(fromUserId: string, limit = 50) {
  return prisma.scrapMessage.findMany({
    where: { fromUserId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { from: true, to: true },
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
    include: { from: true, to: true },
  });
}
