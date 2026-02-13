import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PostComment, ReactionType } from "@/lib/types";
import { ContentWithMedia } from "@/components/ui/ContentWithMedia";
import { EmojiGifInput } from "@/components/ui/EmojiGifInput";
import { getComments, postComment, deleteComment } from "@/api/comments";
import { setCommentReaction, removeCommentReaction } from "@/api/reactions";
import { playReactionSound } from "@/lib/sounds";
import { getCurrentUserId } from "@/api/auth";
import { formatTimestamp, formatFullDate } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const REACTION_EMOJI: Record<ReactionType, string> = {
  headshot: "💀",
  heal: "💉",
  burn: "🔥",
  backstab: "🗡️",
};

const REACTIONS: ReactionType[] = ["headshot", "heal", "burn", "backstab"];

export const COMMENTS_QUERY_KEY = (feedItemId: string) => ["comments", feedItemId] as const;

interface CommentListProps {
  feedItemId: string;
  allowComments?: boolean;
}

function CommentRow({
  comment,
  feedItemId,
  depth,
  onInvalidate,
}: {
  comment: PostComment;
  feedItemId: string;
  depth: number;
  onInvalidate: () => void;
}) {
  const currentUserId = getCurrentUserId();
  const isAuthor = currentUserId !== null && comment.user.id === currentUserId;

  const handleReplySubmit = async (content: string) => {
    if (!content.trim()) return;
    await postComment(feedItemId, content.trim(), comment.id);
    onInvalidate();
  };

  const handleDelete = async () => {
    await deleteComment(comment.id);
    onInvalidate();
  };

  const handleReaction = async (reaction: ReactionType) => {
    const isActive = comment.myReaction === reaction;
    try {
      if (isActive) {
        await removeCommentReaction(comment.id);
      } else {
        playReactionSound(reaction);
        await setCommentReaction(comment.id, reaction);
      }
      onInvalidate();
    } catch {
      // ignore
    }
  };

  const timestampText = formatTimestamp(comment.timestamp);
  const isRelativeTimestamp = timestampText.startsWith("há") || timestampText === "agora";

  return (
    <div className={depth > 0 ? "ml-4 pl-3 border-l-2 border-border" : undefined}>
      <div className="py-2 space-y-1">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Link to={`/profile/${comment.user.id}`} className="font-bold text-foreground hover:text-accent transition-colors">
            {comment.user.nickname}
          </Link>
          {isRelativeTimestamp ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">
                    {timestampText}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[10px]">
                  {formatFullDate(comment.timestamp)}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span>{timestampText}</span>
          )}
          {isAuthor && (
            <button
              type="button"
              onClick={handleDelete}
              className="text-destructive hover:underline"
            >
              Excluir
            </button>
          )}
        </div>
        <ContentWithMedia content={comment.content} />
        <div className="flex items-center gap-2 flex-wrap">
          {REACTIONS.map((reaction) => {
            const count = comment.reactionCounts?.[reaction] ?? 0;
            const isActive = comment.myReaction === reaction;
            return (
              <button
                key={reaction}
                type="button"
                onClick={() => handleReaction(reaction)}
                className={`text-[10px] font-bold uppercase transition-colors ${
                  isActive ? "text-accent" : "text-muted-foreground hover:text-accent"
                }`}
                title={reaction}
              >
                {REACTION_EMOJI[reaction]}
                {count > 0 && ` (${count})`}
              </button>
            );
          })}
          <ReplyButton comment={comment} feedItemId={feedItemId} onInvalidate={onInvalidate} />
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-0">
          {comment.replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              feedItemId={feedItemId}
              depth={depth + 1}
              onInvalidate={onInvalidate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReplyButton({
  comment,
  feedItemId,
  onInvalidate,
}: {
  comment: PostComment;
  feedItemId: string;
  onInvalidate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [replyContent, setReplyContent] = useState("");

  const handleSubmit = async () => {
    if (!replyContent.trim()) return;
    await postComment(feedItemId, replyContent.trim(), comment.id);
    setReplyContent("");
    setOpen(false);
    onInvalidate();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-[10px] font-bold uppercase text-muted-foreground hover:text-accent"
      >
        Responder
      </button>
      {open && (
        <div className="mt-2 w-full">
          <EmojiGifInput
            value={replyContent}
            onChange={setReplyContent}
            placeholder="Responder..."
            rows={2}
          />
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!replyContent.trim()}
              className="px-2 py-1 text-[10px] uppercase bg-accent text-accent-foreground rounded disabled:opacity-50"
            >
              Enviar
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setReplyContent(""); }}
              className="px-2 py-1 text-[10px] uppercase text-muted-foreground hover:bg-muted rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function CommentList({ feedItemId, allowComments = true }: CommentListProps) {
  const queryClient = useQueryClient();
  const { data: comments = [], isLoading } = useQuery({
    queryKey: COMMENTS_QUERY_KEY(feedItemId),
    queryFn: () => getComments(feedItemId),
    enabled: allowComments,
  });

  const [newCommentContent, setNewCommentContent] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: COMMENTS_QUERY_KEY(feedItemId) });
  };

  const handleSubmitTopLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentContent.trim()) return;
    await postComment(feedItemId, newCommentContent.trim());
    setNewCommentContent("");
    invalidate();
  };

  if (!allowComments) return null;

  return (
    <div className="space-y-4">
      <h3 className="font-heading text-xs text-muted-foreground uppercase tracking-widest">
        Comentários
      </h3>
      <form onSubmit={handleSubmitTopLevel} className="space-y-2">
        <EmojiGifInput
          value={newCommentContent}
          onChange={setNewCommentContent}
          placeholder="Adicione um comentário..."
          rows={2}
        />
        <button
          type="submit"
          disabled={!newCommentContent.trim()}
          className="px-3 py-1.5 text-[10px] font-heading uppercase bg-accent text-accent-foreground rounded disabled:opacity-50"
        >
          Comentar
        </button>
      </form>
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando comentários...</p>
      ) : comments.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum comentário ainda.</p>
      ) : (
        <div className="space-y-0">
          {comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              feedItemId={feedItemId}
              depth={0}
              onInvalidate={invalidate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
