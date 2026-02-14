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

export interface SteamGame {
  appId: number;
  name: string;
  iconUrl: string | null;
  playtimeMinutes: number;
  /** Minutes played in the last 2 weeks */
  playtime2WeeksMinutes?: number;
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
  /** True for seed users that are replied to by AI (Gemini) */
  isAiManaged?: boolean;
  /** Steam ID (64-bit) when linked */
  steamId64?: string | null;
  /** Steam profile URL when linked */
  steamProfileUrl?: string | null;
  /** Cached Steam games (with playtime) when linked */
  steamGames?: SteamGame[];
  /** Total playtime across all Steam games (minutes) */
  steamTotalPlaytimeMinutes?: number;
  /** Achievement IDs to show on profile card (default: none) */
  pinnedAchievementIds?: string[];
  /** Up to 3 post/scrap IDs pinned on profile (order = display order) */
  pinnedPostIds?: string[];
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

export type AttachmentType = "image" | "video" | "audio" | "document";

export interface Attachment {
  url: string;
  type: AttachmentType;
  filename?: string;
}

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
  /** Media attachments */
  attachments?: Attachment[];
  /** On profile feed: 1-based pinned order (1, 2, or 3) when pinned */
  pinnedOrder?: number;
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
  attachments?: Attachment[];
}

/** Chat: minimal user for conversation list / message sender */
export interface ChatUser {
  id: string;
  nickname: string;
  name: string;
  avatar: string;
  online: boolean;
  isAiManaged?: boolean;
}

export type ChatMessageType = "text" | "audio" | "video" | "document";

export interface ChatMessage {
  id: string;
  conversationId: string;
  sender: ChatUser;
  content: string | null;
  type: string;
  attachments: Attachment[] | null;
  createdAt: string;
}

export interface ConversationLastPreview {
  id: string;
  content: string | null;
  type: string;
  createdAt: string;
  sender?: { id: string; nickname: string };
}

export interface Conversation {
  id: string;
  otherUser: ChatUser;
  lastMessagePreview: ConversationLastPreview | null;
  lastActivityAt: string;
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

/** Patentes: a cada 5 níveis sobe uma patente (nível 1–4 = Recruta, 5–9 = Soldado, etc.). */
export const RANK_TITLES_BY_INDEX: string[] = [
  "Recruta",   // 0 (níveis 1-4)
  "Soldado",   // 1 (5-9)
  "Cabo",      // 2 (10-14)
  "Sargento", // 3 (15-19)
  "Tenente",   // 4 (20-24)
  "Capitão",   // 5 (25-29)
  "Major",     // 6 (30-34)
  "Coronel",   // 7 (35-39)
  "General",   // 8 (40-44)
  "Comandante", // 9 (45-49)
  "Saxton Hale", // 10+ (50+)
];

export function getRank(level: number): string {
  if (level < 1) return RANK_TITLES_BY_INDEX[0];
  const index = Math.min(
    Math.floor(level / 5),
    RANK_TITLES_BY_INDEX.length - 1
  );
  return RANK_TITLES_BY_INDEX[index];
}
