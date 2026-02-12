import type { Achievement } from "@/lib/types";

interface AchievementGridProps {
  achievements: Achievement[];
}

export function AchievementGrid({ achievements }: AchievementGridProps) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {achievements.map((ach) => (
        <div
          key={ach.id}
          className="group relative flex items-center justify-center w-full aspect-square rounded bg-muted border-2 border-border hover:border-accent transition-colors cursor-pointer tf-shadow-sm"
          title={`${ach.title}: ${ach.description}`}
        >
          <span className="text-lg">{ach.icon}</span>
          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-tf-brown-dark border-2 border-accent rounded text-[10px] text-tf-beige-light whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 tf-shadow-sm">
            <span className="font-bold">{ach.title}</span>
            <br />
            <span className="text-muted-foreground">{ach.description}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
