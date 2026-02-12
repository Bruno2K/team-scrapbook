import type { Request, Response } from "express";
import { listCommunities } from "../services/communityService.js";
import { communityToJSON } from "../views/communityView.js";

export async function getCommunities(_req: Request, res: Response) {
  try {
    const list = await listCommunities();
    res.status(200).json(list.map(communityToJSON));
  } catch {
    res.status(500).json({ message: "Erro ao carregar comunidades" });
  }
}
