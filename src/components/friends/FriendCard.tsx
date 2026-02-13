import { Link } from "react-router-dom";
import type { User } from "@/lib/types";
import { CLASS_EMOJIS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type FriendCardVariant = "friend" | "available" | "blocked";

interface FriendCardProps {
  user: User;
  variant?: FriendCardVariant;
  onSendScrap?: (user: User) => void;
  onRemove?: () => void;
  onBlock?: () => void;
  onAdd?: () => void;
  onUnblock?: () => void;
  addLoading?: boolean;
  unblockLoading?: boolean;
}

export function FriendCard({
  user,
  variant = "friend",
  onSendScrap,
  onRemove,
  onBlock,
  onAdd,
  onUnblock,
  addLoading = false,
  unblockLoading = false,
}: FriendCardProps) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
      <Link to={`/profile/${user.id}`} className="relative flex-shrink-0">
        <div className={`w-9 h-9 rounded flex items-center justify-center text-base border-2 overflow-hidden
          ${user.team === "RED" ? "border-team-red bg-team-red/10" : "border-team-blu bg-team-blu/10"}`}>
          {user.avatar ? (
            <img src={user.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            CLASS_EMOJIS[user.mainClass]
          )}
        </div>
        {variant !== "blocked" && (
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card
            ${user.online ? "bg-accent animate-pulse-glow" : "bg-muted-foreground"}`} />
        )}
      </Link>
      <Link to={`/profile/${user.id}`} className="flex-1 min-w-0 overflow-hidden">
        <p className="text-xs font-bold text-card-foreground line-clamp-2 break-all group-hover:text-accent transition-colors leading-tight">
          {user.nickname}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{user.mainClass}</p>
      </Link>
      <div className="flex items-center gap-2 flex-shrink-0">
        {variant === "friend" && (
          <>
            {onSendScrap && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px] font-heading uppercase tracking-wider"
                onClick={(e) => { e.stopPropagation(); onSendScrap(user); }}
                title="Enviar recado"
              >
                📝 Recado
              </Button>
            )}
            {(onRemove || onBlock) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Ações">
                    ⋮
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onRemove && (
                    <DropdownMenuItem onClick={(e) => { e.preventDefault(); onRemove(); }} className="text-destructive focus:text-destructive">
                      Remover da squad
                    </DropdownMenuItem>
                  )}
                  {onBlock && (
                    <DropdownMenuItem onClick={(e) => { e.preventDefault(); onBlock(); }} className="text-destructive focus:text-destructive">
                      Bloquear
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )}
        {variant === "available" && onAdd && (
          <Button
            variant="default"
            size="sm"
            className="h-7 px-2 text-[10px] font-heading uppercase tracking-wider"
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            disabled={addLoading}
          >
            {addLoading ? "…" : "Adicionar"}
          </Button>
        )}
        {variant === "blocked" && onUnblock && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[10px] font-heading uppercase tracking-wider"
            onClick={(e) => { e.stopPropagation(); onUnblock(); }}
            disabled={unblockLoading}
          >
            {unblockLoading ? "…" : "Desbloquear"}
          </Button>
        )}
      </div>
    </div>
  );
}
