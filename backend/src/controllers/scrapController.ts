import type { Request, Response } from "express";
import { z } from "zod";
import { listScrapsForUser, createScrap } from "../services/scrapService.js";
import { scrapToJSON } from "../views/scrapView.js";

const createScrapSchema = z.object({
  toUserId: z.string().min(1, "Destinatário é obrigatório"),
  content: z.string().min(1, "Conteúdo é obrigatório"),
  reaction: z.enum(["headshot", "heal", "burn", "backstab"]).optional(),
});

export async function getScraps(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  try {
    const items = await listScrapsForUser(req.user.id);
    res.status(200).json(items.map(scrapToJSON));
  } catch {
    res.status(500).json({ message: "Erro ao carregar recados" });
  }
}

export async function postScrap(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const parsed = createScrapSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
    return;
  }
  try {
    const scrap = await createScrap({
      fromUserId: req.user.id,
      toUserId: parsed.data.toUserId,
      content: parsed.data.content,
      reaction: parsed.data.reaction,
    });
    res.status(201).json(scrapToJSON(scrap));
  } catch {
    res.status(500).json({ message: "Erro ao enviar recado" });
  }
}
