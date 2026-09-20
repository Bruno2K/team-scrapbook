import { prisma } from "../../../db/client.js";
import type { IdentityRepository } from "../application/identityApplication.js";

export const prismaIdentityRepository: IdentityRepository = {
  findActorById(userId) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isAiManaged: true },
    });
  },

  async createRefreshSession(input) {
    await prisma.refreshSession.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });
  },

  findRefreshSessionByTokenHash(tokenHash) {
    return prisma.refreshSession.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true },
    });
  },

  async revokeRefreshSessionByTokenHash(tokenHash, revokedAt) {
    await prisma.refreshSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt },
    });
  },
};
