import type { Request, Response } from "express";
import { z } from "zod";
import {
  AuthServiceError,
  register as registerService,
  login as loginService,
} from "../services/authService.js";
import { userToJSON } from "../views/userView.js";
import { prisma } from "../db/client.js";

const registerSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100),
  nickname: z.string().min(2, "Nickname deve ter pelo menos 2 caracteres").max(100),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(200),
  team: z.enum(["RED", "BLU"]).optional(),
  mainClass: z.enum(["Scout", "Soldier", "Pyro", "Demoman", "Heavy", "Engineer", "Medic", "Sniper", "Spy"]).optional(),
}).strict();

const loginSchema = z.object({
  nickname: z.string().min(1, "Nickname é obrigatório").max(100),
  password: z.string().min(1, "Senha é obrigatória").max(200),
}).strict();

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
    return;
  }

  try {
    const result = await registerService(parsed.data);
    const userJSON = userToJSON(
      await prisma.user.findUniqueOrThrow({ where: { id: result.user.id } })
    );
    res.status(201).json({ user: userJSON, token: result.token });
  } catch (err) {
    if (err instanceof AuthServiceError && err.code === "NICKNAME_TAKEN") {
      res.status(400).json({ message: "Nickname já em uso" });
      return;
    }
    res.status(500).json({ message: "Não foi possível registrar" });
  }
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
    return;
  }

  try {
    const result = await loginService(parsed.data);
    const userJSON = userToJSON(
      await prisma.user.findUniqueOrThrow({ where: { id: result.user.id } })
    );
    res.status(200).json({ user: userJSON, token: result.token });
  } catch (err) {
    if (err instanceof AuthServiceError && err.code === "INVALID_CREDENTIALS") {
      res.status(401).json({ message: "Nickname ou senha inválidos" });
      return;
    }
    res.status(500).json({ message: "Não foi possível entrar" });
  }
}
