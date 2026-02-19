import type { Request, Response } from "express";
import type { ScrapReaction } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/client.js";
import {
  listFeed,
  listMyProfileFeed,
  createPost,
  getFeedItemById,
  deleteFeedItem,
} from "../services/feedService.js";
import {
  listCommentsByFeedItemId,
  listCommentsByScrapId,
  createComment as createCommentService,
} from "../services/commentService.js";
import {
  getPostReactionCounts,
  getMyPostReaction,
  getPostReactionCountsForMany,
  getMyPostReactionsForMany,
  setPostReaction as setPostReactionService,
  removePostReaction as removePostReactionService,
  setScrapReaction as setScrapReactionService,
  removeScrapReaction as removeScrapReactionService,
  getScrapReactionCounts,
  getMyScrapReaction,
} from "../services/reactionService.js";
import { getCommentCountByFeedItemIds, getCommentCountByScrapIds } from "../services/commentService.js";
import { getScrapById } from "../services/scrapService.js";
import { feedItemToJSON, scrapToFeedItemJSON } from "../views/feedView.js";
import { userToJSON } from "../views/userView.js";
import { commentToJSON, type CommentWithUser } from "../views/commentView.js";

const attachmentSchema = z.object({
  url: z.string().url(),
  type: z.enum(["image", "video", "audio", "document"]),
  filename: z.string().optional(),
});

const createPostSchema = z.object({
  content: z.string().default(""),
  type: z.enum(["post", "achievement", "community", "scrap"]).optional(),
  allowComments: z.boolean().optional(),
  allowReactions: z.boolean().optional(),
  attachments: z.array(attachmentSchema).optional().default([]),
});

export async function getFeed(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const entries = await listFeed(userId);
    const feedIds = entries
      .filter((e): e is typeof e & { kind: "feed" } => e.kind === "feed")
      .map((e) => e.item.id);
    const scrapIds = entries
      .filter((e): e is typeof e & { kind: "scrap" } => e.kind === "scrap")
      .map((e) => e.item.id);
    
    // Buscar reações e comentários para FeedItems
    const [feedReactionCountsMap, feedMyReactionsMap, feedCommentCountMap] = await Promise.all([
      getPostReactionCountsForMany(feedIds),
      userId ? getMyPostReactionsForMany(feedIds, userId) : Promise.resolve({} as Record<string, ScrapReaction>),
      getCommentCountByFeedItemIds(feedIds),
    ]);
    
    // Buscar reações e comentários para Scraps
    const scrapReactionCountsMap: Record<string, Record<ScrapReaction, number>> = {};
    const scrapMyReactionsMap: Record<string, ScrapReaction> = {};
    const scrapCommentCountMap = scrapIds.length > 0 ? await getCommentCountByScrapIds(scrapIds) : {};
    if (scrapIds.length > 0 && userId) {
      await Promise.all(
        scrapIds.map(async (scrapId) => {
          const [counts, myReaction] = await Promise.all([
            getScrapReactionCounts(scrapId),
            getMyScrapReaction(scrapId, userId),
          ]);
          scrapReactionCountsMap[scrapId] = counts;
          if (myReaction) scrapMyReactionsMap[scrapId] = myReaction;
        })
      );
    }
    
    const json = entries.map((e) => {
      if (e.kind === "scrap") {
        const scrap = e.item;
        const toUser =
          e.direction === "sent" && "to" in scrap && scrap.to ? userToJSON(scrap.to) : undefined;
        return scrapToFeedItemJSON(scrap, {
          direction: e.direction,
          toUser,
          reactionCounts: scrapReactionCountsMap[scrap.id],
          myReaction: scrapMyReactionsMap[scrap.id] ?? undefined,
          commentCount: scrapCommentCountMap[scrap.id] ?? 0,
        });
      }
      return feedItemToJSON(e.item, {
        reactionCounts: feedReactionCountsMap[e.item.id],
        myReaction: feedMyReactionsMap[e.item.id],
        commentCount: feedCommentCountMap[e.item.id] ?? 0,
      });
    });
    res.status(200).json(json);
  } catch (err) {
    res.status(500).json({ message: "Erro ao carregar o feed" });
  }
}

export async function getMyFeed(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  try {
    const userId = req.user.id;
    const [entries, dbUser] = await Promise.all([
      listMyProfileFeed(userId),
      prisma.user.findUnique({
        where: { id: userId },
        select: { pinnedPostIds: true },
      }),
    ]);

    const pinnedPostIds: string[] = Array.isArray(dbUser?.pinnedPostIds)
      ? (dbUser!.pinnedPostIds as string[]).filter((id): id is string => typeof id === "string")
      : [];

    const feedIds = entries
      .filter((e): e is typeof e & { kind: "feed" } => e.kind === "feed")
      .map((e) => e.item.id);
    const scrapIds = entries
      .filter((e): e is typeof e & { kind: "scrap" } => e.kind === "scrap")
      .map((e) => e.item.id);

    const [feedReactionCountsMap, feedMyReactionsMap, feedCommentCountMap] = await Promise.all([
      getPostReactionCountsForMany(feedIds),
      getMyPostReactionsForMany(feedIds, userId),
      getCommentCountByFeedItemIds(feedIds),
    ]);

    const scrapReactionCountsMap: Record<string, Record<ScrapReaction, number>> = {};
    const scrapMyReactionsMap: Record<string, ScrapReaction> = {};
    const scrapCommentCountMap = scrapIds.length > 0 ? await getCommentCountByScrapIds(scrapIds) : {};
    if (scrapIds.length > 0) {
      await Promise.all(
        scrapIds.map(async (scrapId) => {
          const [counts, myReaction] = await Promise.all([
            getScrapReactionCounts(scrapId),
            getMyScrapReaction(scrapId, userId),
          ]);
          scrapReactionCountsMap[scrapId] = counts;
          if (myReaction) scrapMyReactionsMap[scrapId] = myReaction;
        })
      );
    }

    const pinnedOrderById = new Map<string, number>();
    pinnedPostIds.forEach((id, index) => pinnedOrderById.set(id, index + 1));

    const json = entries.map((e) => {
      const pinnedOrder = pinnedOrderById.get(e.item.id);
      if (e.kind === "scrap") {
        const scrap = e.item;
        const toUser =
          e.direction === "sent" && "to" in scrap && scrap.to ? userToJSON(scrap.to) : undefined;
        return scrapToFeedItemJSON(scrap, {
          direction: e.direction,
          toUser,
          reactionCounts: scrapReactionCountsMap[scrap.id],
          myReaction: scrapMyReactionsMap[scrap.id] ?? undefined,
          commentCount: scrapCommentCountMap[scrap.id] ?? 0,
          pinnedOrder,
        });
      }
      return feedItemToJSON(e.item, {
        reactionCounts: feedReactionCountsMap[e.item.id],
        myReaction: feedMyReactionsMap[e.item.id],
        commentCount: feedCommentCountMap[e.item.id] ?? 0,
        pinnedOrder,
      });
    });

    json.sort((a, b) => {
      const aPinned = a.pinnedOrder ?? 0;
      const bPinned = b.pinnedOrder ?? 0;
      if (aPinned && bPinned) return aPinned - bPinned;
      if (aPinned) return -1;
      if (bPinned) return 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    res.status(200).json(json);
  } catch (err) {
    res.status(500).json({ message: "Erro ao carregar suas postagens" });
  }
}

export async function getUserFeed(req: Request, res: Response) {
  const userId = req.params.userId;
  if (!userId) {
    res.status(400).json({ message: "userId é obrigatório" });
    return;
  }
  const viewerId = req.user?.id ?? null;
  try {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, pinnedPostIds: true },
    });
    if (!target) {
      res.status(404).json({ message: "Usuário não encontrado" });
      return;
    }

    const pinnedPostIdsResolved = Array.isArray(target.pinnedPostIds)
      ? (target.pinnedPostIds as string[]).filter((id): id is string => typeof id === "string")
      : [];

    const entriesResolved = await listMyProfileFeed(userId);

    const feedIds = entriesResolved
      .filter((e): e is typeof e & { kind: "feed" } => e.kind === "feed")
      .map((e) => e.item.id);
    const scrapIds = entriesResolved
      .filter((e): e is typeof e & { kind: "scrap" } => e.kind === "scrap")
      .map((e) => e.item.id);

    const [feedReactionCountsMap, feedMyReactionsMap, feedCommentCountMap] = await Promise.all([
      getPostReactionCountsForMany(feedIds),
      viewerId ? getMyPostReactionsForMany(feedIds, viewerId) : Promise.resolve({} as Record<string, ScrapReaction>),
      getCommentCountByFeedItemIds(feedIds),
    ]);

    const scrapReactionCountsMap: Record<string, Record<ScrapReaction, number>> = {};
    const scrapMyReactionsMap: Record<string, ScrapReaction> = {};
    const scrapCommentCountMap = scrapIds.length > 0 ? await getCommentCountByScrapIds(scrapIds) : {};
    if (scrapIds.length > 0 && viewerId) {
      await Promise.all(
        scrapIds.map(async (scrapId) => {
          const [counts, myReaction] = await Promise.all([
            getScrapReactionCounts(scrapId),
            getMyScrapReaction(scrapId, viewerId),
          ]);
          scrapReactionCountsMap[scrapId] = counts;
          if (myReaction) scrapMyReactionsMap[scrapId] = myReaction;
        })
      );
    }

    const pinnedOrderById = new Map<string, number>();
    pinnedPostIdsResolved.forEach((id, index) => pinnedOrderById.set(id, index + 1));

    const json = entriesResolved.map((e) => {
      const pinnedOrder = pinnedOrderById.get(e.item.id);
      if (e.kind === "scrap") {
        const scrap = e.item;
        const toUser =
          e.direction === "sent" && "to" in scrap && scrap.to ? userToJSON(scrap.to) : undefined;
        return scrapToFeedItemJSON(scrap, {
          direction: e.direction,
          toUser,
          reactionCounts: scrapReactionCountsMap[scrap.id],
          myReaction: scrapMyReactionsMap[scrap.id] ?? undefined,
          commentCount: scrapCommentCountMap[scrap.id] ?? 0,
          pinnedOrder,
        });
      }
      return feedItemToJSON(e.item, {
        reactionCounts: feedReactionCountsMap[e.item.id],
        myReaction: feedMyReactionsMap[e.item.id],
        commentCount: feedCommentCountMap[e.item.id] ?? 0,
        pinnedOrder,
      });
    });

    json.sort((a, b) => {
      const aPinned = a.pinnedOrder ?? 0;
      const bPinned = b.pinnedOrder ?? 0;
      if (aPinned && bPinned) return aPinned - bPinned;
      if (aPinned) return -1;
      if (bPinned) return 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    res.status(200).json(json);
  } catch (err) {
    res.status(500).json({ message: "Erro ao carregar postagens" });
  }
}

export async function getPost(req: Request, res: Response) {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ message: "ID do post é obrigatório" });
    return;
  }
  try {
    const userId = req.user?.id;
    // Tentar buscar como FeedItem primeiro
    let item = await getFeedItemById(id);
    let isScrap = false;
    
    // Se não encontrou, tentar como Scrap
    if (!item) {
      const scrap = await getScrapById(id, userId);
      if (scrap) {
        isScrap = true;
        // Determinar direção do scrap
        const direction = scrap.fromUserId === userId ? "sent" : "received";
        const toUser = direction === "sent" && scrap.to ? userToJSON(scrap.to) : undefined;
        // Buscar reações e comentários do scrap
        const [reactionCounts, myReaction, commentsTree] = await Promise.all([
          getScrapReactionCounts(id),
          userId ? getMyScrapReaction(id, userId) : Promise.resolve(null),
          listCommentsByScrapId(id),
        ]);
        type CommentWithReplies = { replies?: CommentWithReplies[] };
        const commentCount = commentsTree.reduce((acc, c) => {
          const countReplies = (comment: CommentWithReplies): number => {
            return 1 + (comment.replies ?? []).reduce(
              (sum: number, r: CommentWithReplies) => sum + countReplies(r),
              0
            );
          };
          return acc + countReplies(c as CommentWithReplies);
        }, 0);
        const postJson = scrapToFeedItemJSON(scrap, {
          direction,
          toUser,
          reactionCounts,
          myReaction: myReaction ?? undefined,
          commentCount,
        });
        const commentsJson = commentsTree.map((c) => commentToJSON(c, userId));
        res.status(200).json({ post: postJson, comments: commentsJson });
        return;
      }
      res.status(404).json({ message: "Post não encontrado" });
      return;
    }
    
    // Processar FeedItem normalmente
    const [reactionCounts, myReaction, commentsTree] = await Promise.all([
      getPostReactionCounts(id),
      userId ? getMyPostReaction(id, userId) : Promise.resolve(null),
      listCommentsByFeedItemId(id),
    ]);
    const postJson = feedItemToJSON(item, {
      reactionCounts,
      myReaction: myReaction ?? undefined,
    });
    const commentsJson = commentsTree.map((c) => commentToJSON(c, userId));
    res.status(200).json({ post: postJson, comments: commentsJson });
  } catch (err) {
    res.status(500).json({ message: "Erro ao carregar o post" });
  }
}

export async function postFeed(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }

  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
    return;
  }
  const content = (parsed.data.content ?? "").trim();
  const attachments = parsed.data.attachments ?? [];
  if (!content && attachments.length === 0) {
    res.status(400).json({ message: "Conteúdo ou anexos são obrigatórios" });
    return;
  }

  try {
    const item = await createPost({
      userId: req.user.id,
      content: content || "",
      type: parsed.data.type,
      allowComments: parsed.data.allowComments,
      allowReactions: parsed.data.allowReactions,
      attachments: attachments.length ? attachments : undefined,
    });
    res.status(201).json(feedItemToJSON(item));
  } catch (err) {
    res.status(500).json({ message: "Erro ao publicar" });
  }
}

export async function getComments(req: Request, res: Response) {
  const feedItemId = req.params.feedItemId ?? req.params.id;
  if (!feedItemId) {
    res.status(400).json({ message: "ID do post é obrigatório" });
    return;
  }
  try {
    // Tentar buscar como FeedItem primeiro, depois como Scrap
    let tree = await listCommentsByFeedItemId(feedItemId);
    if (tree.length === 0) {
      tree = await listCommentsByScrapId(feedItemId);
    }
    const userId = req.user?.id ?? null;
    const json = tree.map((c) => commentToJSON(c, userId));
    res.status(200).json(json);
  } catch (err) {
    res.status(500).json({ message: "Erro ao carregar comentários" });
  }
}

const createCommentSchema = z.object({
  content: z.string().min(1, "Conteúdo é obrigatório"),
  parentId: z.string().nullable().optional(),
});

export async function createComment(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const feedItemId = req.params.feedItemId ?? req.params.id;
  if (!feedItemId) {
    res.status(400).json({ message: "ID do post é obrigatório" });
    return;
  }
  const parsed = createCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
    return;
  }
  try {
    // Tentar como FeedItem primeiro
    let result = await createCommentService(
      req.user.id,
      feedItemId,
      parsed.data.content,
      parsed.data.parentId ?? undefined,
      null
    );
    // Se não encontrou, tentar como Scrap
    if (result === null) {
      result = await createCommentService(
        req.user.id,
        null,
        parsed.data.content,
        parsed.data.parentId ?? undefined,
        feedItemId
      );
    }
    if (result === null) {
      res.status(404).json({ message: "Post não encontrado" });
      return;
    }
    if (result === "disabled") {
      res.status(403).json({ message: "Comentários desativados neste post" });
      return;
    }
    const userId = req.user?.id ?? null;
    res.status(201).json(commentToJSON(result as CommentWithUser, userId));
  } catch (err) {
    res.status(500).json({ message: "Erro ao comentar" });
  }
}

export async function setPostReaction(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const feedItemId = req.params.feedItemId ?? req.params.id;
  if (!feedItemId) {
    res.status(400).json({ message: "ID do post é obrigatório" });
    return;
  }
  const reaction = req.body?.reaction;
  if (!["headshot", "heal", "burn", "backstab"].includes(reaction)) {
    res.status(400).json({ message: "Reação inválida" });
    return;
  }
  try {
    // Tentar como FeedItem primeiro
    let ok = await setPostReactionService(feedItemId, req.user.id, reaction);
    if (!ok) {
      // Se não funcionou, tentar como Scrap
      ok = await setScrapReactionService(feedItemId, req.user.id, reaction);
      if (!ok) {
        res.status(403).json({ message: "Reações desativadas neste post ou você não tem permissão" });
        return;
      }
    }
    res.status(200).json({ reaction });
  } catch (err) {
    res.status(500).json({ message: "Erro ao reagir" });
  }
}

export async function removePostReaction(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const feedItemId = req.params.feedItemId ?? req.params.id;
  if (!feedItemId) {
    res.status(400).json({ message: "ID do post é obrigatório" });
    return;
  }
  try {
    // Tentar remover como FeedItem primeiro
    let removed = await removePostReactionService(feedItemId, req.user.id);
    if (!removed) {
      // Se não funcionou, tentar como Scrap
      removed = await removeScrapReactionService(feedItemId, req.user.id);
    }
    res.status(200).json({ removed });
  } catch (err) {
    res.status(500).json({ message: "Erro ao remover reação" });
  }
}

export async function deletePost(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const feedItemId = req.params.id;
  if (!feedItemId) {
    res.status(400).json({ message: "ID do post é obrigatório" });
    return;
  }
  try {
    const deleted = await deleteFeedItem(feedItemId, req.user.id);
    if (!deleted) {
      res.status(403).json({ message: "Não autorizado a excluir este post" });
      return;
    }
    res.status(200).json({ deleted: true });
  } catch (err) {
    res.status(500).json({ message: "Erro ao excluir post" });
  }
}
