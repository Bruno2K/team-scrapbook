import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { generateAiActions } from "../controllers/aiActionsController.js";

const router = Router();

router.post("/generate", authMiddleware, generateAiActions);

export default router;
