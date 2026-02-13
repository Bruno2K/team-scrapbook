import type { ScrapMessage, ScrapFilter } from "@/lib/types";
import { apiRequest, isApiConfigured } from "./client";
import { getStoredToken } from "./auth";
import { MOCK_SCRAPS } from "@/lib/mockData";

export async function getScraps(filter: ScrapFilter = "received"): Promise<ScrapMessage[]> {
  if (!isApiConfigured() || !getStoredToken()) {
    return filter === "received" ? MOCK_SCRAPS : [];
  }
  try {
    const params = filter !== "received" ? `?filter=${filter}` : "";
    return await apiRequest<ScrapMessage[]>(`/scraps${params}`);
  } catch {
    return filter === "received" ? MOCK_SCRAPS : [];
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
