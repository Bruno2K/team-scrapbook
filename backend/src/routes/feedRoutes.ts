import { Router } from "express";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.js";
import {
  getFeed,
  postFeed,
  getPost,
  getComments,
  createComment,
  setPostReaction,
  removePostReaction,
  deletePost,
} from "../controllers/feedController.js";

const router = Router();

router.get("/", optionalAuthMiddleware, getFeed);
router.post("/", authMiddleware, postFeed);
router.get("/:id/comments", optionalAuthMiddleware, getComments);
router.post("/:id/comments", authMiddleware, createComment);
router.get("/:id", optionalAuthMiddleware, getPost);
router.post("/:id/reactions", authMiddleware, setPostReaction);
router.delete("/:id/reactions", authMiddleware, removePostReaction);
router.delete("/:id", authMiddleware, deletePost);

export default router;
