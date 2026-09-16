import { createRelationshipPolicy } from "./application/relationshipPolicy.js";
import { prismaRelationshipPolicyRepository } from "./persistence/prismaRelationshipPolicyRepository.js";

const policy = createRelationshipPolicy(prismaRelationshipPolicyRepository);

export const isInteractionBlocked = policy.isInteractionBlocked;
export const canInteract = policy.canInteract;
export const canChat = policy.canChat;
