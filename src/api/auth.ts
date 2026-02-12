import type { User } from "@/lib/types";
import { apiRequest, isApiConfigured } from "./client";

const TOKEN_KEY = "token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export interface LoginInput {
  nickname: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  if (!isApiConfigured()) {
    throw new Error("API não configurada. Defina VITE_API_URL no .env");
  }
  const res = await apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  setStoredToken(res.token);
  return res;
}

export interface RegisterInput {
  name: string;
  nickname: string;
  password: string;
  team?: "RED" | "BLU";
  mainClass?: string;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  if (!isApiConfigured()) {
    throw new Error("API não configurada. Defina VITE_API_URL no .env");
  }
  const res = await apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
  setStoredToken(res.token);
  return res;
}
