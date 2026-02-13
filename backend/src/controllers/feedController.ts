import type { Request, Response } from "express";
import type { ScrapReaction } from "@prisma/client";
import { z } from "zod";
import {
  listFeed,
  createPost,
  getFeedItemById,
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
import { commentToJSON } from "../views/commentView.js";

const createPostSchema = z.object({
  content: z.string().min(1, "Conteúdo é obrigatório"),
  type: z.enum(["post", "achievement", "community", "scrap"]).optional(),
  allowComments: z.boolean().optional(),
  allowReactions: z.boolean().optional(),
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
      userId ? getMyPostReactionsForMany(feedIds, userId) : Promise.resolve({}),
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
        const commentCount = commentsTree.reduce((acc, c) => {
          const countReplies = (comment: typeof c): number => {
            return 1 + comment.replies.reduce((sum, r) => sum + countReplies(r), 0);
          };
          return acc + countReplies(c);
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

  try {
    const item = await createPost({
      userId: req.user.id,
      content: parsed.data.content,
      type: parsed.data.type,
      allowComments: parsed.data.allowComments,
      allowReactions: parsed.data.allowReactions,
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
    res.status(201).json(commentToJSON(result, userId));
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
