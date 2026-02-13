import { Router } from "express";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.js";
import {
  getCommunities,
  getRecommendedCommunities,
  getCommunity,
  createCommunity,
  updateCommunity,
  deleteCommunity,
  joinCommunity,
  leaveCommunity,
  getCommunityMembers,
  removeMember,
  getCommunityPosts,
  postToCommunity,
} from "../controllers/communityController.js";

const router = Router();

router.get("/", optionalAuthMiddleware, getCommunities);
router.get("/recommendations", optionalAuthMiddleware, getRecommendedCommunities);
router.get("/:id", optionalAuthMiddleware, getCommunity);
router.get("/:id/members", getCommunityMembers);
router.get("/:id/posts", getCommunityPosts);

router.post("/", authMiddleware, createCommunity);
router.post("/:id/join", authMiddleware, joinCommunity);
router.post("/:id/posts", authMiddleware, postToCommunity);

router.patch("/:id", authMiddleware, updateCommunity);

router.delete("/:id/leave", authMiddleware, leaveCommunity);
router.delete("/:id/members/:userId", authMiddleware, removeMember);
router.delete("/:id", authMiddleware, deleteCommunity);

export default router;
