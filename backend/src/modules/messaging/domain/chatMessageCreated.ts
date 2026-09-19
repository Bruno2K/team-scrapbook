export const MESSAGE_CREATED_EVENT_TYPE = "messaging.message.created" as const;
export const MESSAGE_CREATED_EVENT_VERSION = 1;

export class OutboxPayloadError extends Error {
  constructor() {
    super("OutboxPayloadError");
    this.name = "OutboxPayloadError";
  }
}

export interface ChatMessageCreatedPayload {
  messageId: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
}

export function chatMessageCreatedOutbox(input: ChatMessageCreatedPayload) {
  return {
    eventType: MESSAGE_CREATED_EVENT_TYPE,
    eventVersion: MESSAGE_CREATED_EVENT_VERSION,
    ownerModule: "messaging" as const,
    aggregateType: "ChatMessage",
    aggregateId: input.messageId,
    payload: {
      messageId: input.messageId,
      conversationId: input.conversationId,
      senderId: input.senderId,
      recipientId: input.recipientId,
    },
  };
}

export function parseChatMessageCreatedPayload(payload: unknown): ChatMessageCreatedPayload {
  if (!payload || typeof payload !== "object") throw new OutboxPayloadError();
  const record = payload as Record<string, unknown>;
  const messageId = record.messageId;
  const conversationId = record.conversationId;
  const senderId = record.senderId;
  const recipientId = record.recipientId;
  if (
    typeof messageId !== "string" || messageId.length === 0 || messageId.length > 128
    || typeof conversationId !== "string" || conversationId.length === 0 || conversationId.length > 128
    || typeof senderId !== "string" || senderId.length === 0 || senderId.length > 128
    || typeof recipientId !== "string" || recipientId.length === 0 || recipientId.length > 128
  ) {
    throw new OutboxPayloadError();
  }
  return { messageId, conversationId, senderId, recipientId };
}
