import { isInteractionBlocked } from "../../relationships/index.js";

export interface FeedAccessFacts {
  ownerId: string;
  privateCommunity: boolean;
  actorIsMember: boolean;
}

export interface ScrapAccessFacts {
  fromUserId: string;
  toUserId: string;
}

export interface CommentAccessFacts {
  authorId: string;
  feed: FeedAccessFacts | null;
  scrap: ScrapAccessFacts | null;
}

export interface ContentPolicyRepository {
  getFeedAccess(feedItemId: string, actorId: string | null): Promise<FeedAccessFacts | null>;
  getScrapAccess(scrapId: string): Promise<ScrapAccessFacts | null>;
  getCommentAccess(commentId: string, actorId: string): Promise<CommentAccessFacts | null>;
}

export interface ContentPolicy {
  canViewFeedItem(actorId: string | null, feedItemId: string): Promise<boolean>;
  canInteractWithFeedItem(actorId: string, feedItemId: string): Promise<boolean>;
  canViewScrap(actorId: string | null, scrapId: string): Promise<boolean>;
  canInteractWithScrap(actorId: string, scrapId: string): Promise<boolean>;
  canInteractWithComment(actorId: string, commentId: string): Promise<boolean>;
}

function canViewFeedFacts(facts: FeedAccessFacts | null): boolean {
  return Boolean(facts && (!facts.privateCommunity || facts.actorIsMember));
}

function scrapOtherActor(facts: ScrapAccessFacts, actorId: string): string | null {
  if (facts.fromUserId === actorId) return facts.toUserId;
  if (facts.toUserId === actorId) return facts.fromUserId;
  return null;
}

export function createContentPolicy(repository: ContentPolicyRepository): ContentPolicy {
  return {
    async canViewFeedItem(actorId, feedItemId) {
      return canViewFeedFacts(await repository.getFeedAccess(feedItemId, actorId));
    },

    async canInteractWithFeedItem(actorId, feedItemId) {
      const facts = await repository.getFeedAccess(feedItemId, actorId);
      if (!canViewFeedFacts(facts) || !facts) return false;
      return !(await isInteractionBlocked(actorId, facts.ownerId));
    },

    async canViewScrap(actorId, scrapId) {
      if (!actorId) return false;
      const facts = await repository.getScrapAccess(scrapId);
      return Boolean(facts && scrapOtherActor(facts, actorId));
    },

    async canInteractWithScrap(actorId, scrapId) {
      const facts = await repository.getScrapAccess(scrapId);
      if (!facts) return false;
      const otherActorId = scrapOtherActor(facts, actorId);
      if (!otherActorId) return false;
      return !(await isInteractionBlocked(actorId, otherActorId));
    },

    async canInteractWithComment(actorId, commentId) {
      const facts = await repository.getCommentAccess(commentId, actorId);
      if (!facts) return false;
      if (await isInteractionBlocked(actorId, facts.authorId)) return false;
      if (facts.feed) {
        if (!canViewFeedFacts(facts.feed)) return false;
        return !(await isInteractionBlocked(actorId, facts.feed.ownerId));
      }
      if (facts.scrap) {
        const otherActorId = scrapOtherActor(facts.scrap, actorId);
        return Boolean(otherActorId && !(await isInteractionBlocked(actorId, otherActorId)));
      }
      return false;
    },
  };
}
