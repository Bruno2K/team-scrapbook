import type { Prisma } from "@prisma/client";
import { prisma } from "../../../db/client.js";
import { hasPrismaCode } from "../../../db/transactions.js";
import { appendOutboxEvent } from "../../../platform/outbox/store.js";
import { chatMessageCreatedOutbox } from "../domain/chatMessageCreated.js";
import {
  MessageIdempotencyConflictError,
  type MessagePersistenceOutcome,
  type MessageRecord,
  type MessageRepository,
} from "../application/messageApplication.js";

const senderSelect = {
  id: true,
  nickname: true,
  name: true,
  avatar: true,
  online: true,
  isAiManaged: true,
} as const;

export interface MessageTransactionHooks {
  afterMessageCreated?(context: { messageVisibleInsideTransaction: boolean }): Promise<void>;
}

async function findByIdempotencyKey(
  client: Prisma.TransactionClient | typeof prisma,
  senderId: string,
  idempotencyKey: string,
): Promise<MessageRecord | null> {
  return client.chatMessage.findUnique({
    where: { senderId_idempotencyKey: { senderId, idempotencyKey } },
    include: { sender: { select: senderSelect } },
  });
}

function replayOrConflict(
  message: MessageRecord,
  requestFingerprint: string | null,
): MessagePersistenceOutcome {
  if (message.requestFingerprint !== requestFingerprint) {
    throw new MessageIdempotencyConflictError();
  }
  return { message, disposition: "replayed" };
}

export function createPrismaMessageRepository(
  hooks: MessageTransactionHooks = {},
): MessageRepository {
  return {
    async findReplay(input) {
      if (!input.idempotencyKey) return null;
      const existing = await findByIdempotencyKey(
        prisma,
        input.senderId,
        input.idempotencyKey,
      );
      return existing ? replayOrConflict(existing, input.requestFingerprint) : null;
    },

    async persist(input) {
      const { idempotencyKey, requestFingerprint } = input;
      try {
        return await prisma.$transaction(async (tx) => {
          if (idempotencyKey) {
            const existing = await findByIdempotencyKey(tx, input.senderId, idempotencyKey);
            if (existing) return replayOrConflict(existing, requestFingerprint);
          }

          const message = await tx.chatMessage.create({
            data: {
              conversationId: input.conversationId,
              senderId: input.senderId,
              content: input.content ?? null,
              type: input.type,
              attachments: (input.attachments?.length
                ? input.attachments
                : undefined) as Prisma.InputJsonValue | undefined,
              idempotencyKey: idempotencyKey ?? null,
              requestFingerprint,
            },
            include: { sender: { select: senderSelect } },
          });

          if (hooks.afterMessageCreated) {
            const visible = Boolean(
              await tx.chatMessage.findUnique({
                where: { id: message.id },
                select: { id: true },
              }),
            );
            await hooks.afterMessageCreated({ messageVisibleInsideTransaction: visible });
          }

          const conversation = await tx.conversation.findUnique({
            where: { id: input.conversationId },
            select: { user1Id: true, user2Id: true },
          });
          const recipientId = conversation
            ? (conversation.user1Id === input.senderId ? conversation.user2Id : conversation.user1Id)
            : null;
          if (input.notifyRecipient && recipientId) {
            await appendOutboxEvent(tx, chatMessageCreatedOutbox({
              messageId: message.id,
              conversationId: input.conversationId,
              senderId: input.senderId,
              recipientId,
            }));
          }

          await tx.conversation.update({
            where: { id: input.conversationId },
            data: { updatedAt: message.createdAt },
          });
          return { message, disposition: "created" };
        });
      } catch (error) {
        if (idempotencyKey && hasPrismaCode(error, "P2002")) {
          const winner = await findByIdempotencyKey(prisma, input.senderId, idempotencyKey);
          if (winner) return replayOrConflict(winner, requestFingerprint);
        }
        throw error;
      }
    },
  };
}

export const prismaMessageRepository = createPrismaMessageRepository();
