import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { getScraps, postScrap } from "../controllers/scrapController.js";
import { socialMutationRateLimit } from "../middleware/abuseControls.js";

const router = Router();

router.get("/", authMiddleware, getScraps);
router.post("/", authMiddleware, socialMutationRateLimit, postScrap);

export default router;
