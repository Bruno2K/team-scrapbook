import { createMessagingPolicy } from "./application/messagingPolicy.js";
import { createMessageApplication } from "./application/messageApplication.js";
import { prismaMessagingPolicyRepository } from "./persistence/prismaMessagingPolicyRepository.js";
import { prismaMessageRepository } from "./persistence/prismaMessageRepository.js";

const policy = createMessagingPolicy(prismaMessagingPolicyRepository);
const messages = createMessageApplication(prismaMessageRepository, policy.canSendOrSignal);

export { sendMessageSchema } from "./application/messagingPolicy.js";
export type { SendMessagePayload } from "./application/messagingPolicy.js";
export const getOtherParticipant = policy.getOtherParticipant;
export const canAccessConversation = policy.canAccessConversation;
export const canSendOrSignal = policy.canSendOrSignal;
export const sendMessage = messages.send;
export {
  MessageIdempotencyConflictError,
} from "./application/messageApplication.js";
export {
  parseChatMessageCreatedPayload,
  MESSAGE_CREATED_EVENT_TYPE,
  MESSAGE_CREATED_EVENT_VERSION,
} from "./domain/chatMessageCreated.js";
export type {
  MessageAttachment,
  MessageRecord,
  MessageType,
  SendMessageInput,
  SendMessageOptions,
  SendMessageOutcome,
} from "./application/messageApplication.js";
