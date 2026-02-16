import type { Community as PrismaCommunity, CommunityMember } from "@prisma/client";
import type { User } from "@prisma/client";
import { userToJSON, type UserJSON } from "./userView.js";
import type { CommunityWithMeta } from "../services/communityService.js";

export interface CommunityJSON {
  id: string;
  name: string;
  description: string;
  members: number;
  isPrivate?: boolean;
  dominantClass?: string;
  team?: string;
}

/** List item with optional isMember and friendsInCommunity (when authenticated). */
export interface CommunityListItemJSON extends CommunityJSON {
  isMember?: boolean;
  friendsInCommunity?: UserJSON[];
}

export function communityToJSON(c: PrismaCommunity): CommunityJSON {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    members: c.memberCount,
    isPrivate: c.isPrivate ?? false,
    dominantClass: c.dominantClass ?? undefined,
    team: c.team ?? undefined,
  };
}

export function communityWithMetaToJSON(c: CommunityWithMeta): CommunityListItemJSON {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    members: c.memberCount,
    isPrivate: c.isPrivate,
    dominantClass: c.dominantClass ?? undefined,
    team: c.team ?? undefined,
    isMember: c.isMember,
    friendsInCommunity: c.friendsInCommunity.map(userToJSON),
  };
}

export interface CommunityDetailJSON extends CommunityJSON {
  isMember: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  owner?: { id: string; nickname: string };
}

type CommunityWithOwner = PrismaCommunity & { owner: User | null };

export function communityDetailToJSON(
  c: CommunityWithOwner,
  isMember: boolean,
  isAdmin: boolean,
  isModerator: boolean
): CommunityDetailJSON {
  return {
    ...communityToJSON(c),
    isMember,
    isAdmin,
    isModerator,
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
