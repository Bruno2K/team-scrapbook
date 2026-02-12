import { prisma } from "../db/client.js";

export async function listCommunities(limit = 50) {
  return prisma.community.findMany({
    orderBy: { memberCount: "desc" },
    take: limit,
  });
}
