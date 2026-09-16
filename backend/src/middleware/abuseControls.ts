import type { NextFunction, Request, Response } from "express";
import { ProcessRateLimiter } from "../platform/processRateLimiter.js";

const registrationLimiter = new ProcessRateLimiter(15 * 60_000, 10);
const loginLimiter = new ProcessRateLimiter(15 * 60_000, 10);
const socialLimiter = new ProcessRateLimiter(60_000, 30);
export const messageLimiter = new ProcessRateLimiter(60_000, 60);
const aiActionLimiter = new ProcessRateLimiter(60_000, 2);

function deny(res: Response, retryAfterSeconds: number): void {
  res.setHeader("Retry-After", String(retryAfterSeconds));
  res.status(429).json({ message: "Muitas tentativas. Tente novamente mais tarde." });
}

function actorKey(req: Request): string {
  return req.actor?.id ?? `ip:${req.ip}`;
}

export function registrationRateLimit(req: Request, res: Response, next: NextFunction): void {
  const decision = registrationLimiter.consume(`ip:${req.ip}`);
  if (!decision.allowed) return deny(res, decision.retryAfterSeconds);
  next();
}

export function loginRateLimit(req: Request, res: Response, next: NextFunction): void {
  const nickname = typeof req.body?.nickname === "string" ? req.body.nickname.trim().toLowerCase() : "unknown";
  const decision = loginLimiter.consume(`${req.ip}:${nickname}`);
  if (!decision.allowed) return deny(res, decision.retryAfterSeconds);
  next();
}

export function socialMutationRateLimit(req: Request, res: Response, next: NextFunction): void {
  const decision = socialLimiter.consume(actorKey(req));
  if (!decision.allowed) return deny(res, decision.retryAfterSeconds);
  next();
}

export function messageMutationRateLimit(req: Request, res: Response, next: NextFunction): void {
  const decision = messageLimiter.consume(actorKey(req));
  if (!decision.allowed) return deny(res, decision.retryAfterSeconds);
  next();
}

export function aiActionRateLimit(req: Request, res: Response, next: NextFunction): void {
  const decision = aiActionLimiter.consume(actorKey(req));
  if (!decision.allowed) return deny(res, decision.retryAfterSeconds);
  next();
}
