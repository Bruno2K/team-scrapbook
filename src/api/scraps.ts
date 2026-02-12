import type { ScrapMessage } from "@/lib/types";
import { apiRequest, isApiConfigured } from "./client";
import { getStoredToken } from "./auth";
import { MOCK_SCRAPS } from "@/lib/mockData";

export async function getScraps(): Promise<ScrapMessage[]> {
  if (!isApiConfigured() || !getStoredToken()) {
    return MOCK_SCRAPS;
  }
  try {
    return await apiRequest<ScrapMessage[]>("/scraps");
  } catch {
    return MOCK_SCRAPS;
  }
}

export interface PostScrapInput {
  toUserId: string;
  content: string;
  reaction?: "headshot" | "heal" | "burn" | "backstab";
}

export async function postScrap(input: PostScrapInput): Promise<ScrapMessage> {
  return apiRequest<ScrapMessage>("/scraps", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
