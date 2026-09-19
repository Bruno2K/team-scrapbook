import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const REQUEST_ID_HEADER = "x-request-id";
const MAX_LENGTH = 64;
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

export function normalizeRequestId(value: unknown): string {
  if (typeof value !== "string") return randomUUID();
  const trimmed = value.trim();
  if (!SAFE_REQUEST_ID.test(trimmed) || trimmed.length > MAX_LENGTH) {
    return randomUUID();
  }
  return trimmed;
}

export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const requestId = normalizeRequestId(incoming);
  req.correlationId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
