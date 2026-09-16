import { createRelationshipPolicy } from "./application/relationshipPolicy.js";
import { createRelationshipCommands } from "./application/relationshipCommands.js";
import { prismaRelationshipPolicyRepository } from "./persistence/prismaRelationshipPolicyRepository.js";
import { prismaRelationshipCommandRepository } from "./persistence/prismaRelationshipCommandRepository.js";

const policy = createRelationshipPolicy(prismaRelationshipPolicyRepository);
const commands = createRelationshipCommands(prismaRelationshipCommandRepository);

export const isInteractionBlocked = policy.isInteractionBlocked;
export const canInteract = policy.canInteract;
export const canChat = policy.canChat;
export const acceptFriendRequest = commands.acceptFriendRequest;
export const blockUser = commands.blockUser;
export const requestFriendship = commands.requestFriendship;
export type {
  AcceptFriendRequestResult,
  BlockUserResult,
  RequestFriendshipResult,
} from "./application/relationshipCommands.js";
