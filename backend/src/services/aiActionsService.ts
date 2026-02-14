import type { ScrapReaction, TF2Class } from "@prisma/client";
import { prisma } from "../db/client.js";
import { createPost } from "./feedService.js";
import { createScrap } from "./scrapService.js";
import { createComment } from "./commentService.js";
import { setPostReaction, setScrapReaction } from "./reactionService.js";
import { createCommunityPost, getMember } from "./communityService.js";
import { generateActionContent } from "./geminiService.js";

const REACTIONS: ScrapReaction[] = ["headshot", "heal", "burn", "backstab"];

export interface AiUser {
  id: string;
  mainClass: TF2Class;
  nickname: string;
}

export async function listAiUsers(): Promise<AiUser[]> {
  const users = await prisma.user.findMany({
    where: { isAiManaged: true },
    select: { id: true, mainClass: true, nickname: true },
  });
  return users;
}

type ActionType =
  | "scrap"
  | "feed_post"
  | "community_post"
  | "feed_reaction"
  | "scrap_reaction"
  | "feed_comment"
  | "scrap_comment";

function pick<T>(arr: T[]): T | undefined {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/** Run 10 random AI actions. Returns number of actions successfully created. */
export async function runRandomAiActions(): Promise<{ created: number; errors: string[] }> {
  const aiUsers = await listAiUsers();
  if (aiUsers.length < 2) {
    return { created: 0, errors: ["É necessário pelo menos 2 usuários de IA no sistema."] };
  }

  const [feedItems, scraps, communityMembers] = await Promise.all([
    prisma.feedItem.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      select: { id: true, userId: true, allowReactions: true, allowComments: true, communityId: true },
    }),
    prisma.scrapMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      select: { id: true, fromUserId: true, toUserId: true },
    }),
    prisma.communityMember.findMany({
      where: { userId: { in: aiUsers.map((u) => u.id) } },
      select: { userId: true, communityId: true },
    }),
  ]);

  const feedItemsWithReactions = feedItems.filter((f) => f.allowReactions);
  const feedItemsWithComments = feedItems.filter((f) => f.allowComments);
  const scrapsWithParticipant = (userId: string) =>
    scraps.filter((s) => s.fromUserId === userId || s.toUserId === userId);

  const actionTypes: ActionType[] = [
    "scrap",
    "feed_post",
    "feed_post",
    "community_post",
    "feed_reaction",
    "feed_reaction",
    "scrap_reaction",
    "feed_comment",
    "feed_comment",
    "scrap_comment",
  ];

  let created = 0;
  const errors: string[] = [];

  for (let i = 0; i < actionTypes.length; i++) {
    const actionType = actionTypes[i];
    try {
      switch (actionType) {
        case "scrap": {
          const [from, to] = pickN(aiUsers, 2);
          if (!from || !to || from.id === to.id) break;
          const content =
            (await generateActionContent(from.mainClass, from.nickname, "scrap")) || "Recado em personagem.";
          await createScrap({
            fromUserId: from.id,
            toUserId: to.id,
            content,
          });
          created++;
          break;
        }
        case "feed_post": {
          const author = pick(aiUsers);
          if (!author) break;
          const content =
            (await generateActionContent(author.mainClass, author.nickname, "post")) || "Post em personagem.";
          await createPost({
            userId: author.id,
            content,
            type: "post",
          });
          created++;
          break;
        }
        case "community_post": {
          const membersByUser = new Map<string, string[]>();
          for (const m of communityMembers) {
            const list = membersByUser.get(m.userId) ?? [];
            list.push(m.communityId);
            membersByUser.set(m.userId, list);
          }
          const aiWithCommunities = aiUsers.filter((u) => (membersByUser.get(u.id)?.length ?? 0) > 0);
          const author = pick(aiWithCommunities);
          if (!author) break;
          const communityIds = membersByUser.get(author.id)!;
          const communityId = pick(communityIds);
          if (!communityId) break;
          const member = await getMember(author.id, communityId);
          if (!member) break;
          const content =
            (await generateActionContent(author.mainClass, author.nickname, "post")) || "Post na comunidade.";
          const post = await createCommunityPost(author.id, communityId, {
            content,
            allowComments: true,
            allowReactions: true,
          });
          if (post) created++;
          break;
        }
        case "feed_reaction": {
          const item = pick(feedItemsWithReactions);
          const user = pick(aiUsers);
          if (!item || !user) break;
          const reaction = pick(REACTIONS)!;
          const ok = await setPostReaction(item.id, user.id, reaction);
          if (ok) created++;
          break;
        }
        case "scrap_reaction": {
          const user = pick(aiUsers);
          if (!user) break;
          const userScraps = scrapsWithParticipant(user.id);
          const scrap = pick(userScraps);
          if (!scrap) break;
          const reaction = pick(REACTIONS)!;
          const ok = await setScrapReaction(scrap.id, user.id, reaction);
          if (ok) created++;
          break;
        }
        case "feed_comment": {
          const item = pick(feedItemsWithComments);
          const user = pick(aiUsers);
          if (!item || !user) break;
          const content =
            (await generateActionContent(user.mainClass, user.nickname, "comment")) || "Comentário.";
          const comment = await createComment(user.id, item.id, content, null, null);
          if (comment && comment !== "disabled") created++;
          break;
        }
        case "scrap_comment": {
          const user = pick(aiUsers);
          if (!user) break;
          const userScraps = scrapsWithParticipant(user.id);
          const scrap = pick(userScraps);
          if (!scrap) break;
          const content =
            (await generateActionContent(user.mainClass, user.nickname, "comment")) || "Comentário.";
          const comment = await createComment(user.id, null, content, null, scrap.id);
          if (comment) created++;
          break;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${actionType}: ${msg}`);
    }
  }

  return { created, errors };
}
