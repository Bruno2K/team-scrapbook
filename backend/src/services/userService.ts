import { prisma } from "../db/client.js";
import { createNotification } from "../modules/notifications/index.js";
import {
  acceptFriendRequest as acceptFriendRequestCommand,
  blockUser as blockUserCommand,
  requestFriendship,
  type AcceptFriendRequestResult,
  type BlockUserResult,
} from "../modules/relationships/index.js";

export function friendPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** List users that are friends with the given user (mutual). Excludes blocked. */
export async function listFriends(userId: string) {
  const [user1, user2] = await Promise.all([
    prisma.friendship.findMany({ where: { user1Id: userId }, include: { user2: true } }),
    prisma.friendship.findMany({ where: { user2Id: userId }, include: { user1: true } }),
  ]);
  const friends = [
    ...user1.map((f) => f.user2),
    ...user2.map((f) => f.user1),
  ];
  const blockedIds = await listBlockedIds(userId);
  const blockedByMe = await prisma.blockedUser.findMany({ where: { blockedId: userId } }).then((rows) => rows.map((r) => r.blockerId));
  const allBlocked = new Set([...blockedIds, ...blockedByMe]);
  const filtered = friends.filter((u) => !allBlocked.has(u.id));
  filtered.sort((a, b) => (a.online === b.online ? 0 : a.online ? -1 : 1) || a.nickname.localeCompare(b.nickname));
  return filtered;
}

/** List user IDs that the user has blocked. */
export async function listBlockedIds(userId: string): Promise<string[]> {
  const rows = await prisma.blockedUser.findMany({
    where: { blockerId: userId },
    select: { blockedId: true },
  });
  return rows.map((r) => r.blockedId);
}

/** List blocked users (for "blocked" tab). */
export async function listBlockedUsers(userId: string) {
  const rows = await prisma.blockedUser.findMany({
    where: { blockerId: userId },
    include: { blocked: true },
  });
  return rows.map((r) => r.blocked);
}

/** List users that can be added as friends: not self, not already friends, not blocked either way. Optional search by nickname. */
export async function listUsersAvailableToAdd(userId: string, options: { limit?: number; search?: string } = {}) {
  const { limit = 100, search } = options;
  const [friendRows1, friendRows2, blockedByMe, blockedMe] = await Promise.all([
    prisma.friendship.findMany({ where: { user1Id: userId }, select: { user2Id: true } }),
    prisma.friendship.findMany({ where: { user2Id: userId }, select: { user1Id: true } }),
    prisma.blockedUser.findMany({ where: { blockerId: userId }, select: { blockedId: true } }),
    prisma.blockedUser.findMany({ where: { blockedId: userId }, select: { blockerId: true } }),
  ]);
  const friendIds = new Set([
    ...friendRows1.map((r) => r.user2Id),
    ...friendRows2.map((r) => r.user1Id),
  ]);
  const blocked = new Set([
    ...blockedByMe.map((r) => r.blockedId),
    ...blockedMe.map((r) => r.blockerId),
    userId,
  ]);
  const exclude = new Set([...friendIds, ...blocked]);

  const where: { id: { notIn: string[] }; nickname?: { contains: string } } = {
    id: { notIn: [...exclude] },
  };
  if (search && search.trim()) {
    where.nickname = { contains: search.trim() };
  }
  return prisma.user.findMany({
    where,
    orderBy: [{ online: "desc" }, { nickname: "asc" }],
    take: limit,
  });
}

/** List recommended users to add: friends of friends + users in same community. Excludes self, friends, blocked. */
export async function listRecommendedToAdd(userId: string, limit = 50) {
  const [friendRows1, friendRows2, blockedByMe, blockedMe] = await Promise.all([
    prisma.friendship.findMany({ where: { user1Id: userId }, select: { user2Id: true } }),
    prisma.friendship.findMany({ where: { user2Id: userId }, select: { user1Id: true } }),
    prisma.blockedUser.findMany({ where: { blockerId: userId }, select: { blockedId: true } }),
    prisma.blockedUser.findMany({ where: { blockedId: userId }, select: { blockerId: true } }),
  ]);
  const friendIds = new Set([
    ...friendRows1.map((r) => r.user2Id),
    ...friendRows2.map((r) => r.user1Id),
  ]);
  const blocked = new Set([
    ...blockedByMe.map((r) => r.blockedId),
    ...blockedMe.map((r) => r.blockerId),
    userId,
  ]);
  const exclude = new Set([...friendIds, ...blocked]);

  const myFriendIds = [...friendIds];
  const myCommunityIds = await prisma.communityMember.findMany({
    where: { userId },
    select: { communityId: true },
  }).then((rows) => rows.map((r) => r.communityId));

  const candidateIds = new Set<string>();

  if (myFriendIds.length > 0) {
    const fof1 = await prisma.friendship.findMany({
      where: { user1Id: { in: myFriendIds } },
      select: { user2Id: true },
    });
    const fof2 = await prisma.friendship.findMany({
      where: { user2Id: { in: myFriendIds } },
      select: { user1Id: true },
    });
    [...fof1.map((r) => r.user2Id), ...fof2.map((r) => r.user1Id)].forEach((id) => {
      if (!exclude.has(id)) candidateIds.add(id);
    });
  }

  if (myCommunityIds.length > 0) {
    const sameCommunity = await prisma.communityMember.findMany({
      where: { communityId: { in: myCommunityIds }, userId: { not: userId } },
      select: { userId: true },
    });
    sameCommunity.forEach((r) => {
      if (!exclude.has(r.userId)) candidateIds.add(r.userId);
    });
  }

  if (candidateIds.size === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: [...candidateIds] } },
    orderBy: [{ online: "desc" }, { nickname: "asc" }],
    take: limit,
  });
  return users;
}

export async function addFriend(meId: string, otherId: string): Promise<
  "added" | "request_sent" | "already_friends" | "blocked" | "invalid" | "conflict"
> {
  const result = await requestFriendship(meId, otherId);
  if (result.status === "request_created" || result.status === "request_reactivated") {
    try {
      await createNotification({
        userId: otherId,
        type: "FRIEND_REQUEST",
        payload: { requestId: result.requestId },
      });
    } catch {
      // The relationship request is committed; notification persistence is post-commit best effort.
    }
    return "request_sent";
  }
  if (result.status === "already_pending" || result.status === "already_friends") {
    return "already_friends";
  }
  return result.status;
}

export async function listPendingFriendRequestsForUser(userId: string) {
  return prisma.friendshipRequest.findMany({
    where: { toUserId: userId, status: "PENDING" },
    include: { from: true },
    orderBy: { createdAt: "desc" },
  });
}

export function acceptFriendRequest(
  requestId: string,
  userId: string,
): Promise<AcceptFriendRequestResult> {
  return acceptFriendRequestCommand(requestId, userId);
}

export async function declineFriendRequest(requestId: string, userId: string): Promise<boolean> {
  const request = await prisma.friendshipRequest.findUnique({
    where: { id: requestId },
  });
  if (!request || request.toUserId !== userId || request.status !== "PENDING") return false;
  await prisma.friendshipRequest.update({
    where: { id: requestId },
    data: { status: "DECLINED", respondedAt: new Date() },
  });
  return true;
}

export async function removeFriend(meId: string, otherId: string): Promise<boolean> {
  const [u1, u2] = friendPair(meId, otherId);
  const deleted = await prisma.friendship.deleteMany({
    where: { user1Id: u1, user2Id: u2 },
  });
  return deleted.count > 0;
}

export function blockUser(blockerId: string, blockedId: string): Promise<BlockUserResult> {
  return blockUserCommand(blockerId, blockedId);
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
  const result = await prisma.blockedUser.deleteMany({
    where: { blockerId, blockedId },
  });
  return result.count > 0;
}
