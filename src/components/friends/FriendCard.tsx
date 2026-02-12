import type { User } from "@/lib/types";
import { CLASS_EMOJIS } from "@/lib/types";

interface FriendCardProps {
  user: User;
}

export function FriendCard({ user }: FriendCardProps) {
  return (
    <div className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 transition-colors group cursor-pointer">
      <div className="relative">
        <div className={`w-8 h-8 rounded flex items-center justify-center text-sm border-2
          ${user.team === "RED" ? "border-team-red bg-team-red/10" : "border-team-blu bg-team-blu/10"}`}>
          {CLASS_EMOJIS[user.mainClass]}
        </div>
        {/* Online indicator */}
        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card
          ${user.online ? "bg-accent animate-pulse-glow" : "bg-muted-foreground"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-card-foreground truncate group-hover:text-accent transition-colors">
          {user.nickname}
        </p>
        <p className="text-[10px] text-muted-foreground">{user.mainClass}</p>
      </div>
    </div>
  );
}
