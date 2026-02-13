import type { Request, Response } from "express";
import { z } from "zod";
import { listScrapsReceived, listScrapsSent, createScrap } from "../services/scrapService.js";
import { scrapToJSON } from "../views/scrapView.js";

const createScrapSchema = z.object({
  toUserId: z.string().min(1, "Destinatário é obrigatório"),
  content: z.string().min(1, "Conteúdo é obrigatório"),
  reaction: z.enum(["headshot", "heal", "burn", "backstab"]).optional(),
});

const filterSchema = z.enum(["received", "sent", "all"]);

export async function getScraps(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const filter = filterSchema.safeParse(req.query.filter).data ?? "received";
  try {
    if (filter === "received") {
      const items = await listScrapsReceived(req.user.id);
      return res.status(200).json(items.map((s) => scrapToJSON(s, "received")));
    }
    if (filter === "sent") {
      const items = await listScrapsSent(req.user.id);
      return res.status(200).json(items.map((s) => scrapToJSON(s, "sent")));
    }
    const [received, sent] = await Promise.all([
      listScrapsReceived(req.user.id),
      listScrapsSent(req.user.id),
    ]);
    const receivedJson = received.map((s) => scrapToJSON(s, "received"));
    const sentJson = sent.map((s) => scrapToJSON(s, "sent"));
    const combined = [...receivedJson, ...sentJson].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return res.status(200).json(combined);
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
    res.status(201).json(scrapToJSON(scrap, "sent"));
  } catch {
    res.status(500).json({ message: "Erro ao enviar recado" });
  }
}
