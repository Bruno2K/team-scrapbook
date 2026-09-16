import { prisma } from "../../../db/client.js";
import type { RelationshipPolicyRepository } from "../application/relationshipPolicy.js";

function orderedPair(firstUserId: string, secondUserId: string): [string, string] {
  return firstUserId < secondUserId
    ? [firstUserId, secondUserId]
    : [secondUserId, firstUserId];
}

export const prismaRelationshipPolicyRepository: RelationshipPolicyRepository = {
  async areFriends(firstUserId, secondUserId) {
    const [user1Id, user2Id] = orderedPair(firstUserId, secondUserId);
    return Boolean(await prisma.friendship.findUnique({
      where: { user1Id_user2Id: { user1Id, user2Id } },
      select: { id: true },
    }));
  },

  async isBlockedEitherDirection(firstUserId, secondUserId) {
    return Boolean(await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: firstUserId, blockedId: secondUserId },
          { blockerId: secondUserId, blockedId: firstUserId },
        ],
      },
      select: { id: true },
    }));
  },
};
