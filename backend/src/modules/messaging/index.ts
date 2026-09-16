import { createMessagingPolicy } from "./application/messagingPolicy.js";
import { prismaMessagingPolicyRepository } from "./persistence/prismaMessagingPolicyRepository.js";

const policy = createMessagingPolicy(prismaMessagingPolicyRepository);

export { sendMessageSchema } from "./application/messagingPolicy.js";
export type { SendMessagePayload } from "./application/messagingPolicy.js";
export const getOtherParticipant = policy.getOtherParticipant;
export const canAccessConversation = policy.canAccessConversation;
export const canSendOrSignal = policy.canSendOrSignal;
