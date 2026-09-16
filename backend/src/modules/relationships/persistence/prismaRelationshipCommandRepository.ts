import type { Prisma } from "@prisma/client";
import {
  hasPrismaCode,
  runSerializableTransaction,
  TransactionConflictError,
} from "../../../db/transactions.js";
import type {
  AcceptFriendRequestResult,
  BlockUserResult,
  RelationshipCommandRepository,
  RequestFriendshipResult,
} from "../application/relationshipCommands.js";

export interface RelationshipTransactionHooks {
  afterFriendshipCreated?(context: { friendshipVisibleInsideTransaction: boolean }): Promise<void>;
  afterBlockStateRead?(): Promise<void>;
  afterFriendRequestWritten?(): Promise<void>;
}

class RelationshipStateConflictError extends Error {
  constructor() {
    super("Relationship state changed during the transaction");
    this.name = "RelationshipStateConflictError";
  }
}

function canonicalPair(firstUserId: string, secondUserId: string): [string, string] {
  return firstUserId < secondUserId
    ? [firstUserId, secondUserId]
    : [secondUserId, firstUserId];
}

async function findFriendship(
  tx: Prisma.TransactionClient,
  firstUserId: string,
  secondUserId: string,
) {
  const [user1Id, user2Id] = canonicalPair(firstUserId, secondUserId);
  return tx.friendship.findUnique({
    where: { user1Id_user2Id: { user1Id, user2Id } },
    select: { id: true },
  });
}

export function createPrismaRelationshipCommandRepository(
  hooks: RelationshipTransactionHooks = {},
): RelationshipCommandRepository {
  return {
    async requestFriendship(fromUserId, toUserId): Promise<RequestFriendshipResult> {
      if (fromUserId === toUserId) return { status: "invalid" };

      const execute = () => runSerializableTransaction<RequestFriendshipResult>(async (tx) => {
        if (await findFriendship(tx, fromUserId, toUserId)) {
          return { status: "already_friends" };
        }
        const blocked = await tx.blockedUser.findFirst({
          where: {
            OR: [
              { blockerId: fromUserId, blockedId: toUserId },
              { blockerId: toUserId, blockedId: fromUserId },
            ],
          },
          select: { id: true },
        });
        if (blocked) return { status: "blocked" };

        const existing = await tx.friendshipRequest.findUnique({
          where: { fromUserId_toUserId: { fromUserId, toUserId } },
        });
        if (existing?.status === "PENDING") return { status: "already_pending" };
        if (existing?.status === "ACCEPTED") return { status: "already_friends" };

        if (existing) {
          const transitioned = await tx.friendshipRequest.updateMany({
            where: { id: existing.id, status: "DECLINED" },
            data: { status: "PENDING", respondedAt: null },
          });
          if (transitioned.count !== 1) throw new RelationshipStateConflictError();
          await hooks.afterFriendRequestWritten?.();
          return { status: "request_reactivated", requestId: existing.id };
        }

        const request = await tx.friendshipRequest.create({
          data: { fromUserId, toUserId, status: "PENDING" },
        });
        await hooks.afterFriendRequestWritten?.();
        return { status: "request_created", requestId: request.id };
      });

      try {
        return await execute();
      } catch (error) {
        // A concurrent duplicate insert is resolved through the now-visible winning row.
        if (hasPrismaCode(error, "P2002")) {
          try {
            return await execute();
          } catch (retryError) {
            if (retryError instanceof TransactionConflictError) return { status: "conflict" };
            throw retryError;
          }
        }
        if (
          error instanceof TransactionConflictError ||
          error instanceof RelationshipStateConflictError
        ) return { status: "conflict" };
        throw error;
      }
    },

    async acceptFriendRequest(requestId, actorId): Promise<AcceptFriendRequestResult> {
      try {
        return await runSerializableTransaction<AcceptFriendRequestResult>(async (tx) => {
          const request = await tx.friendshipRequest.findUnique({ where: { id: requestId } });
          if (!request) return "not_found";
          if (request.toUserId !== actorId) return "forbidden";

          const existingFriendship = await findFriendship(
            tx,
            request.fromUserId,
            request.toUserId,
          );
          if (request.status === "ACCEPTED") {
            return existingFriendship ? "already_applied" : "conflict";
          }
          if (request.status !== "PENDING") return "already_processed";

          const blocked = await tx.blockedUser.findFirst({
            where: {
              OR: [
                { blockerId: request.fromUserId, blockedId: request.toUserId },
                { blockerId: request.toUserId, blockedId: request.fromUserId },
              ],
            },
            select: { id: true },
          });
          if (blocked) return "blocked";

          if (!existingFriendship) {
            const [user1Id, user2Id] = canonicalPair(request.fromUserId, request.toUserId);
            await tx.friendship.create({ data: { user1Id, user2Id } });
            if (hooks.afterFriendshipCreated) {
              const visible = Boolean(
                await tx.friendship.findUnique({
                  where: { user1Id_user2Id: { user1Id, user2Id } },
                  select: { id: true },
                }),
              );
              await hooks.afterFriendshipCreated({
                friendshipVisibleInsideTransaction: visible,
              });
            }
          }

          const transitioned = await tx.friendshipRequest.updateMany({
            where: { id: requestId, toUserId: actorId, status: "PENDING" },
            data: { status: "ACCEPTED", respondedAt: new Date() },
          });
          if (transitioned.count !== 1) throw new RelationshipStateConflictError();
          return existingFriendship ? "already_applied" : "accepted";
        });
      } catch (error) {
        if (
          error instanceof TransactionConflictError ||
          error instanceof RelationshipStateConflictError
        ) return "conflict";
        throw error;
      }
    },

    async blockUser(blockerId, blockedId): Promise<BlockUserResult> {
      if (blockerId === blockedId) return "invalid";
      try {
        return await runSerializableTransaction<BlockUserResult>(async (tx) => {
          // Reads participate in Serializable conflict detection against concurrent acceptance.
          await findFriendship(tx, blockerId, blockedId);
          await tx.blockedUser.findFirst({
            where: {
              OR: [
                { blockerId, blockedId },
                { blockerId: blockedId, blockedId: blockerId },
              ],
            },
            select: { id: true },
          });
          await hooks.afterBlockStateRead?.();

          const [user1Id, user2Id] = canonicalPair(blockerId, blockedId);
          await tx.friendship.deleteMany({ where: { user1Id, user2Id } });
          await tx.friendshipRequest.deleteMany({
            where: {
              OR: [
                { fromUserId: blockerId, toUserId: blockedId },
                { fromUserId: blockedId, toUserId: blockerId },
              ],
            },
          });
          await tx.blockedUser.upsert({
            where: { blockerId_blockedId: { blockerId, blockedId } },
            create: { blockerId, blockedId },
            update: {},
          });
          return "blocked";
        });
      } catch (error) {
        if (error instanceof TransactionConflictError) return "conflict";
        throw error;
      }
    },
  };
}

export const prismaRelationshipCommandRepository =
  createPrismaRelationshipCommandRepository();
