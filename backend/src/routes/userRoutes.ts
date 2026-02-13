import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import {
  getMe,
  getFriends,
  getBlocked,
  getAvailableToAdd,
  getRecommendations,
  addFriend,
  removeFriend,
  blockUser,
  unblockUser,
} from "../controllers/userController.js";

const router = Router();

router.get("/me", authMiddleware, getMe);
router.get("/friends", authMiddleware, getFriends);
router.get("/blocked", authMiddleware, getBlocked);
router.get("/available", authMiddleware, getAvailableToAdd);
router.get("/recommendations", authMiddleware, getRecommendations);
router.post("/friends", authMiddleware, addFriend);
router.delete("/friends/:userId", authMiddleware, removeFriend);
router.post("/:userId/block", authMiddleware, blockUser);
router.delete("/:userId/block", authMiddleware, unblockUser);

export default router;
