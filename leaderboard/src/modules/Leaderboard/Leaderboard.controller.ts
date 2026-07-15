import { NextFunction, Request, Response } from "express";
import Leaderboard from "./Leaderboard.model";
import { verifyApiKey } from "../../middleware/middelware";

const getLeaderboard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // limited to 10
    const leaderboard = await Leaderboard.find().sort({ score: 1 }).limit(10);
    res.json(leaderboard);
  } catch (err) {
    next(err);
  }
};

const createScore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const score = new Leaderboard({ ...req.body });
    const result = await score.save();
    res.status(200).json(result);
  } catch {
    res.status(500).json({ message: "internal server error" });
  }
};

export { getLeaderboard, createScore, verifyApiKey };
