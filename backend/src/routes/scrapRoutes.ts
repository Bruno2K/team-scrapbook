import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { getScraps, postScrap } from "../controllers/scrapController.js";

const router = Router();

router.get("/", authMiddleware, getScraps);
router.post("/", authMiddleware, postScrap);

export default router;
