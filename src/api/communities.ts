import type { Community } from "@/lib/types";
import { apiRequest, isApiConfigured } from "./client";
import { MOCK_COMMUNITIES } from "@/lib/mockData";

export async function getCommunities(): Promise<Community[]> {
  if (!isApiConfigured()) {
    return MOCK_COMMUNITIES;
  }
  try {
    return await apiRequest<Community[]>("/communities");
  } catch {
    return MOCK_COMMUNITIES;
  }
}
