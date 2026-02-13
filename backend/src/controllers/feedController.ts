import type { Request, Response } from "express";
import { z } from "zod";
import {
  listFeed,
  createPost,
  getFeedItemById,
} from "../services/feedService.js";
import {
  listCommentsByFeedItemId,
  createComment as createCommentService,
} from "../services/commentService.js";
import {
  getPostReactionCounts,
  getMyPostReaction,
  getPostReactionCountsForMany,
  getMyPostReactionsForMany,
  setPostReaction as setPostReactionService,
  removePostReaction as removePostReactionService,
} from "../services/reactionService.js";
import { getCommentCountByFeedItemIds } from "../services/commentService.js";
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
    const [reactionCountsMap, myReactionsMap, commentCountMap] = await Promise.all([
      getPostReactionCountsForMany(feedIds),
      userId ? getMyPostReactionsForMany(feedIds, userId) : Promise.resolve({}),
      getCommentCountByFeedItemIds(feedIds),
    ]);
    const json = entries.map((e) => {
      if (e.kind === "scrap") {
        const scrap = e.item;
        const toUser =
          e.direction === "sent" && "to" in scrap && scrap.to ? userToJSON(scrap.to) : undefined;
        return scrapToFeedItemJSON(scrap, { direction: e.direction, toUser });
      }
      return feedItemToJSON(e.item, {
        reactionCounts: reactionCountsMap[e.item.id],
        myReaction: myReactionsMap[e.item.id],
        commentCount: commentCountMap[e.item.id] ?? 0,
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
    const item = await getFeedItemById(id);
    if (!item) {
      res.status(404).json({ message: "Post não encontrado" });
      return;
    }
    const userId = req.user?.id ?? null;
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
    const tree = await listCommentsByFeedItemId(feedItemId);
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
    const result = await createCommentService(
      req.user.id,
      feedItemId,
      parsed.data.content,
      parsed.data.parentId ?? undefined
    );
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
    const ok = await setPostReactionService(feedItemId, req.user.id, reaction);
    if (!ok) {
      res.status(403).json({ message: "Reações desativadas neste post" });
      return;
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
    await removePostReactionService(feedItemId, req.user.id);
    res.status(200).json({ removed: true });
  } catch (err) {
    res.status(500).json({ message: "Erro ao remover reação" });
  }
}
