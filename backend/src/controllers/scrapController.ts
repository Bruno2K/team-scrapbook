import type { Request, Response } from "express";
import { z } from "zod";
import { listScrapsReceived, listScrapsSent, createScrap } from "../services/scrapService.js";
import { createNotification } from "../modules/notifications/index.js";
import { scrapToJSON } from "../views/scrapView.js";

const attachmentSchema = z.object({
  url: z.string().url(),
  type: z.enum(["image", "video", "audio", "document"]),
  filename: z.string().max(255).optional(),
}).strict();

const createScrapSchema = z.object({
  toUserId: z.string().min(1, "Destinatário é obrigatório"),
  content: z.string().max(4000).default(""),
  reaction: z.enum(["headshot", "heal", "burn", "backstab"]).optional(),
  attachments: z.array(attachmentSchema).max(5).optional().default([]),
}).strict();

const filterSchema = z.enum(["received", "sent", "all"]);

export async function getScraps(req: Request, res: Response) {
  if (!req.actor) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const filter = filterSchema.safeParse(req.query.filter).data ?? "received";
  try {
    if (filter === "received") {
      const items = await listScrapsReceived(req.actor.id);
      return res.status(200).json(items.map((s) => scrapToJSON(s, "received")));
    }
    if (filter === "sent") {
      const items = await listScrapsSent(req.actor.id);
      return res.status(200).json(items.map((s) => scrapToJSON(s, "sent")));
    }
    const [received, sent] = await Promise.all([
      listScrapsReceived(req.actor.id),
      listScrapsSent(req.actor.id),
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
  if (!req.actor) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const parsed = createScrapSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
    return;
  }
  const { content, attachments } = parsed.data;
  if (!content.trim() && (!attachments || attachments.length === 0)) {
    res.status(400).json({ message: "Conteúdo ou anexos são obrigatórios" });
    return;
  }
  try {
    const scrap = await createScrap({
      fromUserId: req.actor.id,
      toUserId: parsed.data.toUserId,
      content: content.trim(),
      reaction: parsed.data.reaction,
      attachments: parsed.data.attachments,
    });
    if (!scrap) {
      res.status(403).json({ message: "Interação não permitida" });
      return;
    }
    await createNotification({
      userId: parsed.data.toUserId,
      type: "SCRAP",
      payload: { scrapId: scrap.id },
    });
    res.status(201).json(scrapToJSON(scrap, "sent"));
  } catch {
    res.status(500).json({ message: "Erro ao enviar recado" });
  }
}
