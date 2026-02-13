import { Router } from "express";
import { authMiddleware, optionalAuthForSteam } from "../middleware/auth.js";
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
  updatePinnedAchievements,
} from "../controllers/userController.js";
import {
  linkSteam,
  getSteamAuthUrl,
  steamCallback,
  unlinkSteam,
  syncSteam,
} from "../controllers/steamController.js";

const router = Router();

router.get("/me", authMiddleware, getMe);
router.patch("/me/pinned-achievements", authMiddleware, updatePinnedAchievements);
router.get("/friends", authMiddleware, getFriends);
router.get("/blocked", authMiddleware, getBlocked);
router.get("/available", authMiddleware, getAvailableToAdd);
router.get("/recommendations", authMiddleware, getRecommendations);
router.post("/friends", authMiddleware, addFriend);
router.delete("/friends/:userId", authMiddleware, removeFriend);
router.post("/:userId/block", authMiddleware, blockUser);
router.delete("/:userId/block", authMiddleware, unblockUser);

router.post("/me/steam-link", authMiddleware, linkSteam);
router.get("/me/steam/auth", optionalAuthForSteam, getSteamAuthUrl);
router.get("/me/steam/callback", steamCallback);
router.post("/me/steam/unlink", authMiddleware, unlinkSteam);
router.post("/me/steam/sync", authMiddleware, syncSteam);

export default router;
