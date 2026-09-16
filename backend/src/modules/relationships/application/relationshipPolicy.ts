export interface RelationshipPolicyRepository {
  areFriends(firstUserId: string, secondUserId: string): Promise<boolean>;
  isBlockedEitherDirection(firstUserId: string, secondUserId: string): Promise<boolean>;
}

export interface RelationshipPolicy {
  isInteractionBlocked(firstUserId: string, secondUserId: string): Promise<boolean>;
  canInteract(firstUserId: string, secondUserId: string): Promise<boolean>;
  canChat(firstUserId: string, secondUserId: string): Promise<boolean>;
}

export function createRelationshipPolicy(repository: RelationshipPolicyRepository): RelationshipPolicy {
  return {
    async isInteractionBlocked(firstUserId, secondUserId) {
      if (firstUserId === secondUserId) return false;
      return repository.isBlockedEitherDirection(firstUserId, secondUserId);
    },

    async canInteract(firstUserId, secondUserId) {
      if (firstUserId === secondUserId) return false;
      return !(await repository.isBlockedEitherDirection(firstUserId, secondUserId));
    },

    async canChat(firstUserId, secondUserId) {
      if (firstUserId === secondUserId) return false;
      const [friends, blocked] = await Promise.all([
        repository.areFriends(firstUserId, secondUserId),
        repository.isBlockedEitherDirection(firstUserId, secondUserId),
      ]);
      return friends && !blocked;
    },
  };
}
