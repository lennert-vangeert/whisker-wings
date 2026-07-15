import { Express, NextFunction, Request, Response, Router } from "express";
import { errorHandler } from "../middleware/Error/errorHandlerMiddleware";
import leaderboardRoutes from "../modules/Leaderboard/Leaderboard.routes";

const registerRoutes = (app: Express) => {
  // Public routes
  app.use("/", leaderboardRoutes);
  // Error handler middleware
  app.use(errorHandler);
};

export { registerRoutes };
