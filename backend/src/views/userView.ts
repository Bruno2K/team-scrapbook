import type { User } from "@prisma/client";

export interface UserJSON {
  id: string;
  name: string;
  nickname: string;
  team: string;
  mainClass: string;
  level: number;
  avatar: string;
  achievements: Array<{ id: string; title: string; icon: string; description: string }>;
  reputation: string[];
  online: boolean;
}

/** Minimal user shape needed for JSON (allows Prisma include subsets; team/mainClass can be string) */
export type UserLike = Pick<User, "id" | "name" | "nickname" | "level" | "avatar" | "online"> & {
  team: string;
  mainClass: string;
};

export function userToJSON(user: UserLike): UserJSON {
  return {
    id: user.id,
    name: user.name,
    nickname: user.nickname,
    team: user.team,
    mainClass: user.mainClass,
    level: user.level,
    avatar: user.avatar ?? "",
    achievements: [], // TODO: when Achievement model exists
    reputation: [],   // TODO: when reputation relation exists
    online: user.online,
  };
}
