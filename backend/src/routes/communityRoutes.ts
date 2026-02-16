import { Router } from "express";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.js";
import {
  getCommunities,
  getRecommendedCommunities,
  getHypeCommunities,
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
  postInvite,
  getMyPendingInvites,
  getCommunityInvites,
  patchInvite,
  postJoinRequest,
  getJoinRequests,
  getMyPendingJoinRequest,
  patchJoinRequest,
  patchMemberRole,
} from "../controllers/communityController.js";

const router = Router();

router.get("/", optionalAuthMiddleware, getCommunities);
router.get("/recommendations", optionalAuthMiddleware, getRecommendedCommunities);
router.get("/hype", optionalAuthMiddleware, getHypeCommunities);
router.get("/invites/me", authMiddleware, getMyPendingInvites);
router.get("/:id", optionalAuthMiddleware, getCommunity);
router.get("/:id/members", optionalAuthMiddleware, getCommunityMembers);
router.get("/:id/posts", optionalAuthMiddleware, getCommunityPosts);
router.get("/:id/invites", authMiddleware, getCommunityInvites);
router.get("/:id/join-request", authMiddleware, getMyPendingJoinRequest);
router.get("/:id/join-requests", authMiddleware, getJoinRequests);

router.post("/", authMiddleware, createCommunity);
router.post("/:id/join", authMiddleware, joinCommunity);
router.post("/:id/join-request", authMiddleware, postJoinRequest);
router.post("/:id/invites", authMiddleware, postInvite);
router.post("/:id/posts", authMiddleware, postToCommunity);

router.patch("/:id", authMiddleware, updateCommunity);
router.patch("/:id/invites/:inviteId", authMiddleware, patchInvite);
router.patch("/:id/join-requests/:requestId", authMiddleware, patchJoinRequest);
router.patch("/:id/members/:userId/role", authMiddleware, patchMemberRole);

router.delete("/:id/leave", authMiddleware, leaveCommunity);
router.delete("/:id/members/:userId", authMiddleware, removeMember);
router.delete("/:id", authMiddleware, deleteCommunity);

export default router;
