import type { Request, Response } from "express";
import { z } from "zod";
import { listFeed, createPost } from "../services/feedService.js";
import { feedItemToJSON } from "../views/feedView.js";

const createPostSchema = z.object({
  content: z.string().min(1, "Conteúdo é obrigatório"),
  type: z.enum(["post", "achievement", "community", "scrap"]).optional(),
});

export async function getFeed(_req: Request, res: Response) {
  try {
    const items = await listFeed();
    res.status(200).json(items.map(feedItemToJSON));
  } catch (err) {
    res.status(500).json({ message: "Erro ao carregar o feed" });
  }
}

export async function postFeed(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }

  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
    return;
  }

  try {
    const item = await createPost({
      userId: req.user.id,
      content: parsed.data.content,
      type: parsed.data.type,
    });
    res.status(201).json(feedItemToJSON(item));
  } catch (err) {
    res.status(500).json({ message: "Erro ao publicar" });
  }
}
