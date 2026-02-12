import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { getFeed, postFeed } from "../controllers/feedController.js";

const router = Router();

router.get("/", getFeed);
router.post("/", authMiddleware, postFeed);

export default router;
