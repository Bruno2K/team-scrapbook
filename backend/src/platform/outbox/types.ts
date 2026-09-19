export type OutboxStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface NewOutboxEvent {
  eventType: string;
  eventVersion: number;
  ownerModule: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}

export interface OutboxEventRecord {
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
  previousStatus?: OutboxStatus;
}
