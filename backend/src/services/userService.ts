import { prisma } from "../db/client.js";

/**
 * List users (for "friends" / squad list). Excludes the given userId, orders by online first.
 */
export async function listOtherUsers(excludeUserId: string, limit = 50) {
  return prisma.user.findMany({
    where: { id: { not: excludeUserId } },
    orderBy: [{ online: "desc" }, { nickname: "asc" }],
    take: limit,
  });
}
