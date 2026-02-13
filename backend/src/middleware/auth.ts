import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db/client.js";
import { verifyToken } from "../services/authService.js";

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Token não informado" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const { userId } = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(401).json({ message: "Usuário não encontrado" });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Token inválido ou expirado" });
  }
}

/** Sets req.user when a valid token is present; does not 401 when missing. */
export async function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }
  const token = authHeader.slice(7);
  try {
    const { userId } = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) req.user = user;
  } catch {
    // ignore invalid token
  }
  next();
}
