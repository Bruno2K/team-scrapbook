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
  /** Present when listing with auth: whether current user is a member. */
  isMember?: boolean;
  /** Present when listing with auth: friends of current user in this community. */
  friendsInCommunity?: User[];
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

export type ReactionType = "headshot" | "heal" | "burn" | "backstab";

export interface ReactionCounts {
  headshot: number;
  heal: number;
  burn: number;
  backstab: number;
}

export interface FeedItem {
  id: string;
  user: User;
  content: string;
  timestamp: string;
  type: "post" | "achievement" | "community" | "scrap";
  /** Present when type is "scrap": reaction from sender */
  reaction?: ReactionType;
  allowComments?: boolean;
  allowReactions?: boolean;
  /** Present when loaded in list or detail */
  reactionCounts?: ReactionCounts;
  myReaction?: ReactionType;
  /** Total number of comments (including replies) */
  commentCount?: number;
  /** Present when type is "community": which community the post belongs to */
  community?: { id: string; name: string };
  /** Present when type is "scrap": whether current user sent or received it */
  scrapDirection?: "sent" | "received";
  /** Present when type is "scrap" and scrapDirection is "sent": recipient */
  scrapTo?: Pick<User, "id" | "nickname">;
}

export interface PostComment {
  id: string;
  feedItemId: string;
  parentId?: string | null;
  user: User;
  content: string;
  timestamp: string;
  replies?: PostComment[];
  reactionCounts?: ReactionCounts;
  myReaction?: ReactionType;
}

export type ScrapFilter = "received" | "sent" | "all";

export interface ScrapMessage {
  id: string;
  from: User;
  to?: User;
  content: string;
  timestamp: string;
  reaction?: ReactionType;
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
