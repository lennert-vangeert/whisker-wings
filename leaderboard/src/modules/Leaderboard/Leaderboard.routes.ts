import { Router } from "express";
import { createScore, getLeaderboard, verifyApiKey} from "./Leaderboard.controller";

const router = Router();
router.get("/leaderboard", getLeaderboard);
router.post("/createscore", verifyApiKey, createScore);

export default router;
