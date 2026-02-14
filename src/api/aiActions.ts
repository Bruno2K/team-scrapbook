import { apiRequest, isApiConfigured } from "./client";
import { getStoredToken } from "./auth";

export interface GenerateAiActionsResponse {
  created: number;
  message?: string;
  errors?: string[];
}

export async function generateRandomAiActions(): Promise<GenerateAiActionsResponse> {
  if (!isApiConfigured() || !getStoredToken()) {
    throw new Error("Não autorizado");
  }
  return apiRequest<GenerateAiActionsResponse>("/ai-actions/generate", {
    method: "POST",
  });
}
