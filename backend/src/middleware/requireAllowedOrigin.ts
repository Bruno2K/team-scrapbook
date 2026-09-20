import type { NextFunction, Request, Response } from "express";
import { isAllowedFrontendOrigin } from "../platform/frontendOrigin.js";

export function requireAllowedOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
  if (!isAllowedFrontendOrigin(origin)) {
    res.status(403).json({ message: "Origin não permitida" });
    return;
  }
  next();
}
