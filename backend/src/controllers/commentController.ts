import type { Request, Response } from "express";
import { deleteComment as deleteCommentService } from "../services/commentService.js";
import {
  setCommentReaction as setCommentReactionService,
  removeCommentReaction as removeCommentReactionService,
} from "../services/reactionService.js";

export async function deleteComment(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const commentId = req.params.commentId;
  if (!commentId) {
    res.status(400).json({ message: "ID do comentário é obrigatório" });
    return;
  }
  try {
    const ok = await deleteCommentService(commentId, req.user.id);
    if (!ok) {
      res.status(403).json({ message: "Não autorizado a excluir este comentário" });
      return;
    }
    res.status(200).json({ deleted: true });
  } catch (err) {
    res.status(500).json({ message: "Erro ao excluir comentário" });
  }
}

export async function setCommentReaction(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const commentId = req.params.commentId;
  if (!commentId) {
    res.status(400).json({ message: "ID do comentário é obrigatório" });
    return;
  }
  const reaction = req.body?.reaction;
  if (!["headshot", "heal", "burn", "backstab"].includes(reaction)) {
    res.status(400).json({ message: "Reação inválida" });
    return;
  }
  try {
    await setCommentReactionService(commentId, req.user.id, reaction);
    res.status(200).json({ reaction });
  } catch (err) {
    res.status(500).json({ message: "Erro ao reagir" });
  }
}

export async function removeCommentReaction(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Não autorizado" });
    return;
  }
  const commentId = req.params.commentId;
  if (!commentId) {
    res.status(400).json({ message: "ID do comentário é obrigatório" });
    return;
  }
  try {
    await removeCommentReactionService(commentId, req.user.id);
    res.status(200).json({ removed: true });
  } catch (err) {
    res.status(500).json({ message: "Erro ao remover reação" });
  }
}
