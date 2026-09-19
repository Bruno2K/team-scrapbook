export type OutboxHandler = (input: { eventType: string; eventVersion: number; payload: unknown }) => Promise<void>;

export interface OutboxConsumer {
  eventType: string;
  eventVersion: number;
  handler: OutboxHandler;
}

export function createOutboxConsumerRegistry() {
  const handlers = new Map<string, OutboxHandler>();

  return {
    register(consumer: OutboxConsumer): void {
      handlers.set(`${consumer.eventType}:${consumer.eventVersion}`, consumer.handler);
    },
    resolve(eventType: string, eventVersion: number): OutboxHandler | undefined {
      return handlers.get(`${eventType}:${eventVersion}`);
    },
    clear(): void {
      handlers.clear();
    },
  };
}

export type OutboxConsumerRegistry = ReturnType<typeof createOutboxConsumerRegistry>;

export const defaultOutboxConsumers = createOutboxConsumerRegistry();
