import bcrypt from "bcryptjs";
import { prisma } from "../db/client.js";
import type { Team, TF2Class } from "@prisma/client";
import { issueAccessToken } from "../modules/identity/index.js";

const SALT_ROUNDS = 10;

export class AuthServiceError extends Error {
  constructor(public readonly code: "NICKNAME_TAKEN" | "INVALID_CREDENTIALS") {
    super(code);
    this.name = "AuthServiceError";
  }
}

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
    throw new AuthServiceError("NICKNAME_TAKEN");
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  let user;
  try {
    user = await prisma.user.create({
      data: {
        name: input.name,
        nickname: input.nickname,
        passwordHash,
        team: input.team ?? "RED",
        mainClass: input.mainClass ?? "Scout",
      },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      throw new AuthServiceError("NICKNAME_TAKEN");
    }
    throw error;
  }

  const token = issueAccessToken(user.id);
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
  if (!user || user.isAiManaged) {
    throw new AuthServiceError("INVALID_CREDENTIALS");
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AuthServiceError("INVALID_CREDENTIALS");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { online: true },
  });

  const token = issueAccessToken(user.id);
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
