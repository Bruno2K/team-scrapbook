import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import {
  getConversations,
  postConversation,
  getConversationMessages,
  postMessage,
} from "../controllers/chatController.js";

const router = Router();

router.use(authMiddleware);

router.get("/conversations", getConversations);
router.post("/conversations", postConversation);
router.get("/conversations/:conversationId/messages", getConversationMessages);
router.post("/messages", postMessage);

export default router;
