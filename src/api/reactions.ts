import type { ReactionType } from "@/lib/types";
import { apiRequest, isApiConfigured } from "./client";

export async function setPostReaction(feedItemId: string, reaction: ReactionType): Promise<void> {
  if (!isApiConfigured()) return;
  await apiRequest(`/feed/${feedItemId}/reactions`, {
    method: "POST",
    body: JSON.stringify({ reaction }),
  });
}

export async function removePostReaction(feedItemId: string): Promise<void> {
  if (!isApiConfigured()) return;
  await apiRequest(`/feed/${feedItemId}/reactions`, { method: "DELETE" });
}

export async function setCommentReaction(commentId: string, reaction: ReactionType): Promise<void> {
  if (!isApiConfigured()) return;
  await apiRequest(`/comments/${commentId}/reactions`, {
    method: "POST",
    body: JSON.stringify({ reaction }),
  });
}

export async function removeCommentReaction(commentId: string): Promise<void> {
  if (!isApiConfigured()) return;
  await apiRequest(`/comments/${commentId}/reactions`, { method: "DELETE" });
}
