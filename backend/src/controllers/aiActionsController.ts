import type { Request, Response } from "express";
export async function generateAiActions(req: Request, res: Response) {
  if (!req.actor) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  // Automated actors are internal principals. A human session cannot request
  // arbitrary mutations under AI identities.
  res.status(403).json({ message: "Ações automatizadas não estão disponíveis para sessões de usuário." });
}
