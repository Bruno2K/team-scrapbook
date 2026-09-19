import { parseChatMessageCreatedPayload } from "./modules/messaging/index.js";
import { createNotification } from "./modules/notifications/index.js";
import { defaultOutboxConsumers } from "./platform/outbox/index.js";

export function registerProductOutboxConsumers(): void {
  defaultOutboxConsumers.register({
    eventType: "messaging.message.created",
    eventVersion: 1,
    async handler({ payload }) {
      const event = parseChatMessageCreatedPayload(payload);
      await createNotification({
        userId: event.recipientId,
        type: "CHAT_MESSAGE",
        payload: {
          conversationId: event.conversationId,
          messageId: event.messageId,
        },
        dedupeKey: `chat-message:${event.messageId}`,
      });
    },
  });
}
