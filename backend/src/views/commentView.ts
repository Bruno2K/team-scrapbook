import type { PostComment, CommentReaction, ScrapReaction } from "@prisma/client";
import { userToJSON, type UserJSON } from "./userView.js";

export type ReactionType = ScrapReaction;

export interface ReactionCountsJSON {
  headshot: number;
  heal: number;
  burn: number;
  backstab: number;
}

export interface PostCommentJSON {
  id: string;
  feedItemId: string | null;
  parentId: string | null;
  user: UserJSON;
  content: string;
  timestamp: string;
  replies: PostCommentJSON[];
  reactionCounts: ReactionCountsJSON;
  myReaction: ReactionType | null;
}

export type CommentWithUser = PostComment & {
  user: Parameters<typeof userToJSON>[0];
  reactions: { userId: string; reaction: ScrapReaction }[];
  replies?: CommentWithUser[];
};

function reactionCountsFromReactions(reactions: { reaction: ScrapReaction }[]): ReactionCountsJSON {
  const counts: ReactionCountsJSON = { headshot: 0, heal: 0, burn: 0, backstab: 0 };
  for (const r of reactions) counts[r.reaction]++;
  return counts;
}

function getMyReaction(
  reactions: { userId: string; reaction: ScrapReaction }[],
  currentUserId: string | null
): ReactionType | null {
  if (!currentUserId || !reactions?.length) return null;
  const r = reactions.find((x) => x.userId === currentUserId);
  return r?.reaction ?? null;
}

export function commentToJSON(
  comment: CommentWithUser,
  currentUserId: string | null = null
): PostCommentJSON {
  const reactions = comment.reactions ?? [];
  const reactionCounts = reactionCountsFromReactions(reactions);
  const myReaction = getMyReaction(reactions, currentUserId);
  return {
    id: comment.id,
    feedItemId: comment.feedItemId,
    parentId: comment.parentId,
    user: userToJSON(comment.user),
    content: comment.content,
    timestamp: comment.createdAt.toISOString(),
    replies: (comment.replies ?? []).map((r) => commentToJSON(r, currentUserId)),
    reactionCounts,
    myReaction,
  };
}
