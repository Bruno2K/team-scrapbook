import type { Prisma } from "@prisma/client";
import { prisma } from "./client.js";

const SERIALIZABLE_ATTEMPTS = 3;

export class TransactionConflictError extends Error {
  readonly code = "TRANSACTION_CONFLICT";

  constructor(options?: { cause?: unknown }) {
    super("The database transaction could not be completed safely", options);
    this.name = "TransactionConflictError";
  }
}

export function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

/**
 * Run one short database-only workflow at Serializable isolation. Only Prisma's documented
 * write-conflict/deadlock code is retried; validation, uniqueness and application failures are not.
 */
export async function runSerializableTransaction<T>(
  work: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  let lastConflict: unknown;
  for (let attempt = 1; attempt <= SERIALIZABLE_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: "Serializable" });
    } catch (error) {
      if (!hasPrismaCode(error, "P2034")) throw error;
      lastConflict = error;
    }
  }
  throw new TransactionConflictError({ cause: lastConflict });
}
