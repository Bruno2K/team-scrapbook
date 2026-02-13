import type { Achievement } from "@/lib/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AchievementGridProps {
  achievements: Achievement[];
}

export function AchievementGrid({ achievements }: AchievementGridProps) {
  return (
    <TooltipProvider>
      <div className="grid grid-cols-4 gap-1.5">
        {achievements.map((ach) => (
          <Tooltip key={ach.id}>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center w-full aspect-square rounded bg-muted border-2 border-border hover:border-accent transition-colors cursor-pointer tf-shadow-sm">
                <span className="text-lg">{ach.icon}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] max-w-[200px]">
              <div className="space-y-1">
                <div className="font-bold">{ach.title}</div>
                <div className="text-muted-foreground">{ach.description}</div>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
