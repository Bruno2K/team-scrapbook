import { createHash } from "node:crypto";

export type MessageType = "TEXT" | "AUDIO" | "VIDEO" | "DOCUMENT";

export interface MessageAttachment {
  url: string;
  type: string;
  filename?: string;
}

export interface SendMessageInput {
  conversationId: string;
  senderId: string;
  content?: string | null;
  type: MessageType;
  attachments?: MessageAttachment[] | null;
  idempotencyKey?: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderId: string;
  idempotencyKey: string | null;
  requestFingerprint: string | null;
  content: string | null;
  type: MessageType;
  attachments: unknown;
  createdAt: Date;
  sender: {
    id: string;
    nickname: string;
    name: string;
    avatar: string | null;
    online: boolean;
    isAiManaged: boolean;
  };
}

export type MessagePersistenceOutcome = {
  message: MessageRecord;
  disposition: "created" | "replayed";
};

export interface MessageRepository {
  findReplay(
    input: SendMessageInput & { requestFingerprint: string | null },
  ): Promise<MessagePersistenceOutcome | null>;
  persist(
    input: SendMessageInput & { requestFingerprint: string | null },
  ): Promise<MessagePersistenceOutcome>;
}

export interface SendMessageOptions {
  afterCommit?(message: MessageRecord): Promise<void>;
}

export type SendMessageOutcome = MessagePersistenceOutcome & {
  postCommitEffectFailed: boolean;
};

export class MessageIdempotencyConflictError extends Error {
  readonly code = "IDEMPOTENCY_KEY_REUSED";

  constructor() {
    super("Idempotency key was already used with a different message payload");
    this.name = "MessageIdempotencyConflictError";
  }
}

function fingerprint(input: SendMessageInput): string | null {
  if (!input.idempotencyKey) return null;
  const canonical = {
    conversationId: input.conversationId,
    content: input.content ?? null,
    type: input.type,
    attachments: (input.attachments ?? []).map((attachment) => ({
      url: attachment.url,
      type: attachment.type,
      filename: attachment.filename ?? null,
    })),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function createMessageApplication(
  repository: MessageRepository,
  canSend: (conversationId: string, senderId: string) => Promise<boolean>,
) {
  return {
    async send(
      input: SendMessageInput,
      options: SendMessageOptions = {},
    ): Promise<SendMessageOutcome | null> {
      const persistenceInput = {
        ...input,
        requestFingerprint: fingerprint(input),
      };
      // A replay resolves a previously authorized, committed outcome; it is not a new mutation.
      // This also lets a retry repair a missing deduplicated post-commit notification.
      const replay = input.idempotencyKey
        ? await repository.findReplay(persistenceInput)
        : null;
      if (!replay && !(await canSend(input.conversationId, input.senderId))) return null;
      const persisted = replay ?? await repository.persist(persistenceInput);

      let postCommitEffectFailed = false;
      if (options.afterCommit) {
        try {
          await options.afterCommit(persisted.message);
        } catch {
          // The durable message is already committed. Delivery is intentionally best effort.
          postCommitEffectFailed = true;
        }
      }
      return { ...persisted, postCommitEffectFailed };
    },
  };
}
