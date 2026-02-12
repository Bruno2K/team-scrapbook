import { Router } from "express";
import { getCommunities } from "../controllers/communityController.js";

const router = Router();

router.get("/", getCommunities);

export default router;
