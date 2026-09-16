export type AcceptFriendRequestResult =
  | "accepted"
  | "already_applied"
  | "blocked"
  | "not_found"
  | "forbidden"
  | "already_processed"
  | "conflict";

export type BlockUserResult = "blocked" | "invalid" | "conflict";

export type RequestFriendshipResult =
  | { status: "request_created" | "request_reactivated"; requestId: string }
  | { status: "already_pending" | "already_friends" | "blocked" | "invalid" | "conflict" };

export interface RelationshipCommandRepository {
  acceptFriendRequest(requestId: string, actorId: string): Promise<AcceptFriendRequestResult>;
  blockUser(blockerId: string, blockedId: string): Promise<BlockUserResult>;
  requestFriendship(fromUserId: string, toUserId: string): Promise<RequestFriendshipResult>;
}

export function createRelationshipCommands(repository: RelationshipCommandRepository) {
  return {
    acceptFriendRequest(requestId: string, actorId: string) {
      return repository.acceptFriendRequest(requestId, actorId);
    },
    blockUser(blockerId: string, blockedId: string) {
      if (blockerId === blockedId) return Promise.resolve<BlockUserResult>("invalid");
      return repository.blockUser(blockerId, blockedId);
    },
    requestFriendship(fromUserId: string, toUserId: string) {
      if (fromUserId === toUserId) {
        return Promise.resolve<RequestFriendshipResult>({ status: "invalid" });
      }
      return repository.requestFriendship(fromUserId, toUserId);
    },
  };
}
