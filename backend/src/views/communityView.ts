import type { Community as PrismaCommunity } from "@prisma/client";

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
