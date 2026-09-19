import type { Request, Response, NextFunction } from "express";
import { resolveAccessToken } from "../modules/identity/index.js";
import { log } from "../platform/observability/index.js";

function attachActor(req: Request, actor: NonNullable<Request["actor"]>): void {
  req.actor = actor;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    log.warn({ event: "auth.rejected", requestId: req.correlationId, status: 401, failureCategory: "unknown" });
    res.status(401).json({ message: "Token não informado" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const actor = await resolveAccessToken(token);
    if (!actor || actor.isAiManaged) {
      log.warn({ event: "auth.rejected", requestId: req.correlationId, status: 401, failureCategory: "unknown" });
      res.status(401).json({ message: "Token inválido ou expirado" });
      return;
    }
    attachActor(req, actor);
    next();
  } catch {
    log.warn({ event: "auth.rejected", requestId: req.correlationId, status: 401, failureCategory: "unknown" });
    res.status(401).json({ message: "Token inválido ou expirado" });
  }
}

/** Sets req.actor when a valid current actor is present; does not 401 when missing. */
export async function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }
  const token = authHeader.slice(7);
  try {
    const actor = await resolveAccessToken(token);
    if (actor && !actor.isAiManaged) attachActor(req, actor);
  } catch {
    // ignore invalid token
  }
  next();
}
