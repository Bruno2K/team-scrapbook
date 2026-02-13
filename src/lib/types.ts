export type Team = "RED" | "BLU";

export type TF2Class =
  | "Scout"
  | "Soldier"
  | "Pyro"
  | "Demoman"
  | "Heavy"
  | "Engineer"
  | "Medic"
  | "Sniper"
  | "Spy";

export interface Achievement {
  id: string;
  title: string;
  icon: string;
  description: string;
}

export interface User {
  id: string;
  name: string;
  nickname: string;
  team: Team;
  mainClass: TF2Class;
  level: number;
  avatar: string;
  achievements: Achievement[];
  reputation: string[];
  online: boolean;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  members: number;
  dominantClass?: TF2Class;
  team?: Team;
}

export interface CommunityDetail extends Community {
  isMember: boolean;
  isAdmin: boolean;
  owner?: { id: string; nickname: string };
}

export interface CommunityMemberRole {
  user: User;
  role: "MEMBER" | "ADMIN";
  joinedAt: string;
}

export interface FeedItem {
  id: string;
  user: User;
  content: string;
  timestamp: string;
  type: "post" | "achievement" | "community" | "scrap";
}

export type ScrapFilter = "received" | "sent" | "all";

export interface ScrapMessage {
  id: string;
  from: User;
  to?: User;
  content: string;
  timestamp: string;
  reaction?: "headshot" | "heal" | "burn" | "backstab";
  direction?: "sent" | "received";
}

export type ReputationBadge =
  | "Top Fragger"
  | "Medic de Confiança"
  | "Backstab Master"
  | "Carregou o Time"
  | "Demolition Expert"
  | "Sentry God";

export const CLASS_EMOJIS: Record<TF2Class, string> = {
  Scout: "🏃",
  Soldier: "🚀",
  Pyro: "🔥",
  Demoman: "💣",
  Heavy: "🔫",
  Engineer: "🔧",
  Medic: "💉",
  Sniper: "🎯",
  Spy: "🗡️",
};

export const RANK_TITLES: Record<number, string> = {
  1: "Recruta",
  5: "Soldado",
  10: "Cabo",
  15: "Sargento",
  20: "Tenente",
  30: "Capitão",
  40: "Major",
  50: "Coronel",
  60: "General",
  99: "Saxton Hale",
};

export function getRank(level: number): string {
  const levels = Object.keys(RANK_TITLES)
    .map(Number)
    .sort((a, b) => b - a);
  for (const l of levels) {
    if (level >= l) return RANK_TITLES[l];
  }
  return "Recruta";
}
