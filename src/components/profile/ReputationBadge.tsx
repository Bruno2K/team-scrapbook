const BADGE_STYLES: Record<string, { icon: string; color: string }> = {
  "Top Fragger": { icon: "💀", color: "bg-team-red/20 border-team-red text-team-red-light" },
  "Medic de Confiança": { icon: "💉", color: "bg-team-blu/20 border-team-blu text-team-blu-light" },
  "Backstab Master": { icon: "🗡️", color: "bg-muted border-accent text-accent" },
  "Carregou o Time": { icon: "⭐", color: "bg-tf-yellow/10 border-tf-yellow text-tf-yellow" },
  "Demolition Expert": { icon: "💣", color: "bg-team-red/20 border-team-red text-team-red-light" },
  "Sentry God": { icon: "🔧", color: "bg-muted border-tf-beige text-tf-beige" },
};

interface ReputationBadgeProps {
  badge: string;
}

export function ReputationBadge({ badge }: ReputationBadgeProps) {
  const style = BADGE_STYLES[badge] || { icon: "🎖️", color: "bg-muted border-border text-foreground" };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border-2 text-[10px] font-bold uppercase tracking-wider ${style.color}`}>
      <span>{style.icon}</span>
      {badge}
    </span>
  );
}
