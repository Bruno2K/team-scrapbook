import type { Community as PrismaCommunity, CommunityMember } from "@prisma/client";
import type { User } from "@prisma/client";
import { userToJSON, type UserJSON } from "./userView.js";

export interface CommunityJSON {
  id: string;
  name: string;
  description: string;
  members: number;
  dominantClass?: string;
  team?: string;
}

export function communityToJSON(c: PrismaCommunity): CommunityJSON {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    members: c.memberCount,
    dominantClass: c.dominantClass ?? undefined,
    team: c.team ?? undefined,
  };
}

export interface CommunityDetailJSON extends CommunityJSON {
  isMember: boolean;
  isAdmin: boolean;
  owner?: { id: string; nickname: string };
}

type CommunityWithOwner = PrismaCommunity & { owner: User | null };

export function communityDetailToJSON(
  c: CommunityWithOwner,
  isMember: boolean,
  isAdmin: boolean
): CommunityDetailJSON {
  return {
    ...communityToJSON(c),
    isMember,
    isAdmin,
    owner: c.owner ? { id: c.owner.id, nickname: c.owner.nickname } : undefined,
  };
}

export interface CommunityMemberJSON {
  user: UserJSON;
  role: string;
  joinedAt: string;
}

type MemberWithUser = CommunityMember & { user: User };

export function communityMemberToJSON(m: MemberWithUser): CommunityMemberJSON {
  return {
    user: userToJSON(m.user),
    role: m.role,
    joinedAt: m.joinedAt.toISOString(),
  };
}
