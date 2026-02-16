import { Router } from "express";
import { authMiddleware, optionalAuthMiddleware, optionalAuthForSteam } from "../middleware/auth.js";
import {
  getMe,
  updateMe,
  getFriends,
  getBlocked,
  getAvailableToAdd,
  getRecommendations,
  addFriend,
  removeFriend,
  blockUser,
  unblockUser,
  getMyFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  updatePinnedAchievements,
  updatePinnedPosts,
  getUserById,
  getUserFriends,
  getUserCommunities,
  getUserMedia,
} from "../controllers/userController.js";
import {
  linkSteam,
  getSteamAuthUrl,
  steamCallback,
  unlinkSteam,
  syncSteam,
} from "../controllers/steamController.js";
import { getMyFeed, getUserFeed } from "../controllers/feedController.js";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notificationsController.js";

const router = Router();

router.get("/me", authMiddleware, getMe);
router.patch("/me", authMiddleware, updateMe);
router.get("/me/feed", authMiddleware, getMyFeed);
router.patch("/me/pinned-achievements", authMiddleware, updatePinnedAchievements);
router.patch("/me/pinned-posts", authMiddleware, updatePinnedPosts);
router.get("/me/notifications", authMiddleware, getMyNotifications);
router.patch("/me/notifications/read-all", authMiddleware, markAllNotificationsRead);
router.patch("/me/notifications/:id/read", authMiddleware, markNotificationRead);
router.get("/friends", authMiddleware, getFriends);
router.get("/me/friend-requests", authMiddleware, getMyFriendRequests);
router.post("/me/friend-requests/:requestId/accept", authMiddleware, acceptFriendRequest);
router.post("/me/friend-requests/:requestId/decline", authMiddleware, declineFriendRequest);
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

router.get("/:userId/feed", optionalAuthMiddleware, getUserFeed);
router.get("/:userId/friends", optionalAuthMiddleware, getUserFriends);
router.get("/:userId/communities", optionalAuthMiddleware, getUserCommunities);
router.get("/:userId/media", optionalAuthMiddleware, getUserMedia);
router.get("/:userId", optionalAuthMiddleware, getUserById);

export default router;
