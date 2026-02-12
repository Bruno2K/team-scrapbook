import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { getMe, getFriends } from "../controllers/userController.js";

const router = Router();

router.get("/me", authMiddleware, getMe);
router.get("/friends", authMiddleware, getFriends);

export default router;
