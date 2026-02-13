import type { PostComment } from "@/lib/types";
import { apiRequest, isApiConfigured } from "./client";

export async function getComments(feedItemId: string): Promise<PostComment[]> {
  if (!isApiConfigured()) return [];
  try {
    return await apiRequest<PostComment[]>(`/feed/${feedItemId}/comments`);
  } catch {
    return [];
  }
}

export async function postComment(
  feedItemId: string,
  content: string,
  parentId?: string | null
): Promise<PostComment> {
  return apiRequest<PostComment>(`/feed/${feedItemId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content, parentId: parentId ?? undefined }),
  });
}

export async function deleteComment(commentId: string): Promise<void> {
  await apiRequest(`/comments/${commentId}`, { method: "DELETE" });
}
