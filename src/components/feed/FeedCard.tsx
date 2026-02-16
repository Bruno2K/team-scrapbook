import { useState } from "react";
import type { FeedItem, ReactionType } from "@/lib/types";
import { CLASS_EMOJIS } from "@/lib/types";
import { ContentWithMedia } from "@/components/ui/ContentWithMedia";
import { AttachmentPreview } from "@/components/feed/AttachmentPreview";
import { setPostReaction, removePostReaction } from "@/api/reactions";
import { playReactionSound } from "@/lib/sounds";
import { Link } from "react-router-dom";
import { formatTimestamp, formatFullDate } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getCurrentUserId } from "@/api/auth";
import { ConfirmDeletePostModal } from "./ConfirmDeletePostModal";

// #region agent log
const _log = (loc: string, msg: string, data: Record<string, unknown>) => {
  fetch("http://127.0.0.1:7243/ingest/a5d22442-9ad0-4754-8b54-cb093bb3d2cf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location: loc, message: msg, data, timestamp: Date.now(), hypothesisId: "H5" }),
  }).catch(() => {});
};
// #endregion

const REACTIONS: ReactionType[] = ["headshot", "heal", "burn", "backstab"];

interface FeedCardProps {
  item: FeedItem;
  /** Callback after reaction change so parent can invalidate (e.g. feed or post detail). */
  onReactionChange?: () => void;
  /** Callback after post deletion so parent can invalidate. */
  onDelete?: () => void;
  /** When true, current user can delete this post (e.g. community mod/admin). */
  canModerate?: boolean;
}

const REACTION_EMOJI: Record<string, string> = {
  headshot: "💀",
  heal: "💉",
  burn: "🔥",
  backstab: "🗡️",
};

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  post: { label: "POST", color: "bg-muted text-muted-foreground" },
  achievement: { label: "CONQUISTA", color: "bg-tf-yellow/20 text-tf-yellow" },
  community: { label: "COMUNIDADE", color: "bg-team-blu/20 text-team-blu-light" },
  scrap: { label: "RECADO", color: "bg-team-red/20 text-team-red-light" },
};

export function FeedCard({ item, onReactionChange, onDelete, canModerate = false }: FeedCardProps) {
  _log("FeedCard.tsx:render", "FeedCard_render", {
    itemId: item.id,
    contentType: typeof item.content,
    contentLen: item.content?.length,
    hasUser: !!item.user,
    mainClass: item.user?.mainClass,
  });
  const user = item.user ?? ({} as FeedItem["user"]);
  const team = user.team === "RED" ? "RED" : "BLU";
  const borderClass = team === "RED" ? "border-l-team-red" : "border-l-team-blu";
  const typeInfo = TYPE_LABELS[item.type] || TYPE_LABELS.post;
  const classEmoji = user.mainClass && CLASS_EMOJIS[user.mainClass as keyof typeof CLASS_EMOJIS] ? CLASS_EMOJIS[user.mainClass as keyof typeof CLASS_EMOJIS] : "👤";

  const isScrap = item.type === "scrap";
  const timestampText = formatTimestamp(item.timestamp);
  const isRelativeTimestamp = timestampText.startsWith("há") || timestampText === "agora";
  const currentUserId = getCurrentUserId();
  const isAuthor = currentUserId !== null && user.id === currentUserId;
  const canDelete = isAuthor || canModerate;
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className={`tf-card border-l-4 ${borderClass} p-4 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link
          to={`/profile/${user.id}`}
          className={`w-8 h-8 rounded flex items-center justify-center text-lg border-2 overflow-hidden shrink-0
            ${team === "RED" ? "border-team-red bg-team-red/10" : "border-team-blu bg-team-blu/10"}`}
        >
          {user.avatar ? (
            <img src={user.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            classEmoji
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link to={`/profile/${user.id}`} className="font-heading text-xs text-card-foreground truncate hover:text-accent transition-colors">
              {user.nickname ?? "—"}
            </Link>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${typeInfo.color}`}>
              {typeInfo.label}
            </span>
            {item.pinnedOrder != null && item.pinnedOrder >= 1 && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-accent/20 text-accent" title="Fixado no perfil">
                📌 Fixado
              </span>
            )}
            {item.type === "scrap" && item.reaction && (
              <span className="text-sm" title={item.reaction}>
                {REACTION_EMOJI[item.reaction] ?? item.reaction}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isRelativeTimestamp ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[10px] text-muted-foreground cursor-help">
                      {timestampText}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[10px]">
                    {formatFullDate(item.timestamp)}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <span className="text-[10px] text-muted-foreground">
                {timestampText}
              </span>
            )}
            {item.type === "community" && item.community && (
              <Link
                to={`/communities/${item.community.id}`}
                className="text-[10px] text-accent hover:text-tf-yellow-light transition-colors font-heading uppercase tracking-wider"
              >
                Em {item.community.name}
              </Link>
            )}
            {item.type === "scrap" && item.scrapDirection === "sent" && item.scrapTo && (
              <span className="text-[10px] text-muted-foreground">
                Enviado para <span className="text-card-foreground font-medium">{item.scrapTo.nickname}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Attachments */}
      {item.attachments?.length ? (
        <AttachmentPreview attachments={item.attachments} className="my-2" />
      ) : null}

      {/* Content */}
      <ContentWithMedia content={item.content ?? ""} />

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1 border-t border-border flex-wrap">
        {item.allowReactions !== false && REACTIONS.map((reaction) => {
          const count = item.reactionCounts?.[reaction] ?? 0;
          const isActive = item.myReaction === reaction;
          const handleClick = async () => {
            try {
              if (isActive) {
                await removePostReaction(item.id);
              } else {
                playReactionSound(reaction);
                await setPostReaction(item.id, reaction);
              }
              onReactionChange?.();
            } catch {
              // ignore
            }
          };
          return (
            <button
              key={reaction}
              type="button"
              onClick={handleClick}
              className={`text-[10px] font-bold uppercase transition-colors ${
                isActive ? "text-accent" : "text-muted-foreground hover:text-accent"
              }`}
              title={reaction}
            >
              {REACTION_EMOJI[reaction]} {reaction}
              {count > 0 && <span className="ml-0.5">({count})</span>}
            </button>
          );
        })}
        <Link
          to={`/post/${item.id}`}
          className="text-[10px] font-bold uppercase text-muted-foreground hover:text-accent transition-colors ml-auto flex items-center gap-1.5"
        >
          {typeof item.commentCount === "number" && item.commentCount > 0 && (
            <span className="text-muted-foreground/80" title="Comentários">
              💬 {item.commentCount}
            </span>
          )}
          Ver post
        </Link>
        <Link
          to={`/post/${item.id}`}
          className="text-[10px] font-bold uppercase text-accent hover:text-tf-yellow-light transition-colors flex items-center gap-1.5"
        >
          Responder
        </Link>
        {canDelete && onDelete && item.type !== "scrap" && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setDeleteOpen(true); }}
            className="text-[10px] font-bold uppercase text-destructive hover:text-destructive/80 transition-colors"
          >
            Excluir
          </button>
        )}
      </div>
      {onDelete && (
        <ConfirmDeletePostModal
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          post={item}
          onConfirm={onDelete}
        />
      )}
    </div>
  );
}
