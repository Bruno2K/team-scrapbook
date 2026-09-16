import { createContentPolicy } from "./application/contentPolicy.js";
import { prismaContentPolicyRepository } from "./persistence/prismaContentPolicyRepository.js";

const policy = createContentPolicy(prismaContentPolicyRepository);

export const canViewFeedItem = policy.canViewFeedItem;
export const canInteractWithFeedItem = policy.canInteractWithFeedItem;
export const canViewScrap = policy.canViewScrap;
export const canInteractWithScrap = policy.canInteractWithScrap;
export const canInteractWithComment = policy.canInteractWithComment;
