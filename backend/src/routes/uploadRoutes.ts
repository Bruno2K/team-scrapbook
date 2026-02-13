import express from "express";
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { presign, uploadFile } from "../controllers/uploadController.js";

const router = Router();

router.post("/presign", authMiddleware, presign);

// Proxy upload: body = raw file, avoids browser CORS with R2
const rawParser = express.raw({ type: () => true, limit: "50mb" });
router.post("/file", authMiddleware, rawParser, uploadFile);

export default router;
