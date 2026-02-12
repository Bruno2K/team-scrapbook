import type { Request, Response } from "express";
import { userToJSON } from "../views/userView.js";
import { listOtherUsers } from "../services/userService.js";

export function getMe(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  res.status(200).json(userToJSON(req.user));
}

export async function getFriends(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  try {
    const users = await listOtherUsers(req.user.id);
    res.status(200).json(users.map(userToJSON));
  } catch {
    res.status(500).json({ message: "Erro ao carregar squad" });
  }
}
