import { prisma } from "../db/client.js";
import type { ScrapReaction } from "@prisma/client";
import { canInteract } from "../modules/relationships/index.js";

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

export type AttachmentInput = { url: string; type: "image" | "video" | "audio" | "document"; filename?: string };

export interface CreateScrapInput {
  fromUserId: string;
  toUserId: string;
  content: string;
  reaction?: ScrapReaction;
  attachments?: AttachmentInput[];
}

export async function createScrap(input: CreateScrapInput) {
  if (!(await canInteract(input.fromUserId, input.toUserId))) return null;
  return prisma.scrapMessage.create({
    data: {
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      content: input.content,
      reaction: input.reaction,
      attachments: (input.attachments?.length ? input.attachments : undefined) as object | undefined,
    },
    include: { from: true, to: true },
  });
}

export async function getScrapById(scrapId: string, userId?: string) {
  const scrap = await prisma.scrapMessage.findUnique({
    where: { id: scrapId },
    include: { from: true, to: true },
  });
  if (!scrap) return null;
  // Verificar se o usuário tem acesso ao scrap
  if (!userId || (scrap.fromUserId !== userId && scrap.toUserId !== userId)) {
    return null;
  }
  return scrap;
}
