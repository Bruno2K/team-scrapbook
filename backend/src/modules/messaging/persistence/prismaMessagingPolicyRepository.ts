import { prisma } from "../../../db/client.js";
import type { MessagingPolicyRepository } from "../application/messagingPolicy.js";

export const prismaMessagingPolicyRepository: MessagingPolicyRepository = {
  getParticipants(conversationId) {
    return prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { user1Id: true, user2Id: true },
    });
  },
};
