import type { Request, Response } from "express";
import { runRandomAiActions } from "../services/aiActionsService.js";

export async function generateAiActions(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  try {
    const { created, errors } = await runRandomAiActions();
    if (created === 0 && errors.length > 0 && errors[0]?.includes("pelo menos 2 usuários")) {
      res.status(400).json({ message: errors[0] });
      return;
    }
    res.status(201).json({
      created,
      message: created > 0 ? `${created} ações geradas.` : "Nenhuma ação pôde ser gerada.",
      ...(errors.length > 0 && { errors }),
    });
  } catch {
    res.status(500).json({ message: "Falha ao gerar ações" });
  }
}
