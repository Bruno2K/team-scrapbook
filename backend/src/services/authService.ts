import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db/client.js";
import type { Team, TF2Class } from "@prisma/client";

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

export interface RegisterInput {
  name: string;
  nickname: string;
  password: string;
  team?: Team;
  mainClass?: TF2Class;
}

export interface LoginInput {
  nickname: string;
  password: string;
}

export interface AuthResult {
  user: { id: string; name: string; nickname: string; team: string; mainClass: string; level: number; avatar: string | null; online: boolean };
  token: string;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { nickname: input.nickname } });
  if (existing) {
    throw new Error("Nickname já em uso");
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      nickname: input.nickname,
      passwordHash,
      team: input.team ?? "RED",
      mainClass: input.mainClass ?? "Scout",
    },
  });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
  return {
    user: {
      id: user.id,
      name: user.name,
      nickname: user.nickname,
      team: user.team,
      mainClass: user.mainClass,
      level: user.level,
      avatar: user.avatar,
      online: user.online,
    },
    token,
  };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { nickname: input.nickname } });
  if (!user) {
    throw new Error("Nickname ou senha inválidos");
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new Error("Nickname ou senha inválidos");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { online: true },
  });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
  return {
    user: {
      id: user.id,
      name: user.name,
      nickname: user.nickname,
      team: user.team,
      mainClass: user.mainClass,
      level: user.level,
      avatar: user.avatar,
      online: true,
    },
    token,
  };
}

export function verifyToken(token: string): { userId: string } {
  const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
  return payload;
}
