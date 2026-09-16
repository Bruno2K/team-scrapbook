import { prisma } from "../../../db/client.js";
import type {
  CommentAccessFacts,
  ContentPolicyRepository,
  FeedAccessFacts,
} from "../application/contentPolicy.js";

function feedFacts(
  feed: {
    userId: string;
    community: { isPrivate: boolean; members: Array<{ userId: string }> } | null;
  },
  actorId: string | null,
): FeedAccessFacts {
  return {
    ownerId: feed.userId,
    privateCommunity: feed.community?.isPrivate ?? false,
    actorIsMember: Boolean(actorId && feed.community?.members.some((member) => member.userId === actorId)),
  };
}

const feedSelect = {
  userId: true,
  community: {
    select: {
      isPrivate: true,
      members: { select: { userId: true } },
    },
  },
} as const;

export const prismaContentPolicyRepository: ContentPolicyRepository = {
  async getFeedAccess(feedItemId, actorId) {
    const feed = await prisma.feedItem.findUnique({ where: { id: feedItemId }, select: feedSelect });
    return feed ? feedFacts(feed, actorId) : null;
  },

  getScrapAccess(scrapId) {
    return prisma.scrapMessage.findUnique({
      where: { id: scrapId },
      select: { fromUserId: true, toUserId: true },
    });
  },

  async getCommentAccess(commentId, actorId) {
    const comment = await prisma.postComment.findUnique({
      where: { id: commentId },
      select: {
        userId: true,
        feedItem: { select: feedSelect },
        scrap: { select: { fromUserId: true, toUserId: true } },
      },
    });
    if (!comment) return null;
    const result: CommentAccessFacts = {
      authorId: comment.userId,
      feed: comment.feedItem ? feedFacts(comment.feedItem, actorId) : null,
      scrap: comment.scrap,
    };
    return result;
  },
};
