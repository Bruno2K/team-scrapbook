import { Router } from "express";
import { register, login, refresh, logout } from "../controllers/authController.js";
import { loginRateLimit, registrationRateLimit } from "../middleware/abuseControls.js";
import { noStoreCacheControl } from "../middleware/noStoreCacheControl.js";
import { requireAllowedOrigin } from "../middleware/requireAllowedOrigin.js";

const router = Router();

router.use(noStoreCacheControl);
router.post("/register", registrationRateLimit, register);
router.post("/login", loginRateLimit, login);
router.post("/refresh", requireAllowedOrigin, refresh);
router.post("/logout", requireAllowedOrigin, logout);

export default router;
