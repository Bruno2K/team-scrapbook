import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { generateAiActions } from "../controllers/aiActionsController.js";
import { aiActionRateLimit } from "../middleware/abuseControls.js";

const router = Router();

router.post("/generate", authMiddleware, aiActionRateLimit, generateAiActions);

export default router;
