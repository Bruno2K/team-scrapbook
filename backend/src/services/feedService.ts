import { prisma } from "../db/client.js";
import type { FeedType } from "@prisma/client";

export async function listFeed(limit = 50) {
  return prisma.feedItem.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: true },
  });
}

export interface CreatePostInput {
  userId: string;
  content: string;
  type?: FeedType;
}

export async function createPost(input: CreatePostInput) {
  return prisma.feedItem.create({
    data: {
      userId: input.userId,
      content: input.content,
      type: input.type ?? "post",
    },
    include: { user: true },
  });
}
