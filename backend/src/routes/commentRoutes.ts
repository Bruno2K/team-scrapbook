import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import {
  deleteComment,
  setCommentReaction,
  removeCommentReaction,
} from "../controllers/commentController.js";

const router = Router();

router.delete("/:commentId", authMiddleware, deleteComment);
router.post("/:commentId/reactions", authMiddleware, setCommentReaction);
router.delete("/:commentId/reactions", authMiddleware, removeCommentReaction);

export default router;
