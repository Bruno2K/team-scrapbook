import { Prisma, type PrismaClient } from "@prisma/client";
import type { NewOutboxEvent, OutboxEventRecord, OutboxStatus } from "./types.js";

export type OutboxTransactionClient = Prisma.TransactionClient;

type ClaimRow = {
  id: string;
  eventType: string;
  eventVersion: number;
  ownerModule: string;
  aggregateType: string | null;
  aggregateId: string | null;
  payload: unknown;
  status: OutboxStatus;
  attemptCount: number;
  availableAt: Date;
  claimedAt: Date | null;
  claimExpiresAt: Date | null;
  claimOwner: string | null;
  processedAt: Date | null;
  failedAt: Date | null;
  failureCategory: string | null;
  lastErrorCode: string | null;
  createdAt: Date;
  previousStatus: OutboxStatus;
};

export async function appendOutboxEvent(
  tx: OutboxTransactionClient,
  event: NewOutboxEvent,
): Promise<void> {
  await tx.outboxEvent.create({
    data: {
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      ownerModule: event.ownerModule,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload as Prisma.InputJsonValue,
    },
  });
}

export async function claimOutboxBatch(
  db: PrismaClient,
  input: { batchSize: number; leaseMs: number; workerId: string; maxAttempts: number },
): Promise<OutboxEventRecord[]> {
  const rows = await db.$queryRaw<ClaimRow[]>(Prisma.sql`
    UPDATE "OutboxEvent" AS o
    SET
      "status" = 'PROCESSING'::"OutboxStatus",
      "attemptCount" = o."attemptCount" + 1,
      "claimedAt" = NOW(),
      "claimExpiresAt" = NOW() + (${input.leaseMs}::integer * INTERVAL '1 millisecond'),
      "availableAt" = NOW() + (${input.leaseMs}::integer * INTERVAL '1 millisecond'),
      "claimOwner" = ${input.workerId},
      "updatedAt" = NOW()
    FROM (
      SELECT id, "status" AS "previousStatus"
      FROM "OutboxEvent"
      WHERE "availableAt" <= NOW()
        AND (
          ("status" = 'PENDING'::"OutboxStatus" AND "attemptCount" < ${input.maxAttempts})
          OR "status" = 'PROCESSING'::"OutboxStatus"
        )
      ORDER BY "availableAt" ASC, "createdAt" ASC
      LIMIT ${input.batchSize}
      FOR UPDATE SKIP LOCKED
    ) AS claimed
    WHERE o.id = claimed.id
    RETURNING
      o.id,
      o."eventType",
      o."eventVersion",
      o."ownerModule",
      o."aggregateType",
      o."aggregateId",
      o.payload,
      o.status,
      o."attemptCount",
      o."availableAt",
      o."claimedAt",
      o."claimExpiresAt",
      o."claimOwner",
      o."processedAt",
      o."failedAt",
      o."failureCategory",
      o."lastErrorCode",
      o."createdAt",
      claimed."previousStatus"
  `);

  return rows.map((row) => ({
    ...row,
    previousStatus: row.previousStatus,
  }));
}

export async function markOutboxCompleted(
  db: PrismaClient,
  input: { id: string; claimOwner: string },
): Promise<boolean> {
  const result = await db.outboxEvent.updateMany({
    where: { id: input.id, status: "PROCESSING", claimOwner: input.claimOwner },
    data: {
      status: "COMPLETED",
      processedAt: new Date(),
      claimExpiresAt: null,
      claimOwner: null,
    },
  });
  return result.count === 1;
}

export async function markOutboxRetry(
  db: PrismaClient,
  input: { id: string; claimOwner: string; availableAt: Date; failureCategory: string; lastErrorCode: string },
): Promise<boolean> {
  const result = await db.outboxEvent.updateMany({
    where: { id: input.id, status: "PROCESSING", claimOwner: input.claimOwner },
    data: {
      status: "PENDING",
      availableAt: input.availableAt,
      claimExpiresAt: null,
      claimOwner: null,
      failureCategory: input.failureCategory,
      lastErrorCode: input.lastErrorCode,
    },
  });
  return result.count === 1;
}

export async function markOutboxFailed(
  db: PrismaClient,
  input: { id: string; claimOwner: string; failureCategory: string; lastErrorCode: string },
): Promise<boolean> {
  const result = await db.outboxEvent.updateMany({
    where: { id: input.id, status: "PROCESSING", claimOwner: input.claimOwner },
    data: {
      status: "FAILED",
      failedAt: new Date(),
      claimExpiresAt: null,
      claimOwner: null,
      failureCategory: input.failureCategory,
      lastErrorCode: input.lastErrorCode,
    },
  });
  return result.count === 1;
}

export async function countOutboxBacklog(db: PrismaClient): Promise<number> {
  return db.outboxEvent.count({
    where: { status: { in: ["PENDING", "PROCESSING"] } },
  });
}

export async function replayTerminalOutboxEvent(db: PrismaClient, id: string): Promise<void> {
  await db.outboxEvent.updateMany({
    where: { id, status: "FAILED" },
    data: {
      status: "PENDING",
      attemptCount: 0,
      availableAt: new Date(),
      failedAt: null,
      processedAt: null,
      claimedAt: null,
      claimExpiresAt: null,
      claimOwner: null,
      failureCategory: null,
      lastErrorCode: null,
    },
  });
}
