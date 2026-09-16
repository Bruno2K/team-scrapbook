import { prisma } from "../../../db/client.js";
import type { IdentityRepository } from "../application/identityApplication.js";

export const prismaIdentityRepository: IdentityRepository = {
  findActorById(userId) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isAiManaged: true },
    });
  },
};
