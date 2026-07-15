import express, { Express } from "express";
import { registerRoutes } from "./routes/routes";
import { registerMiddleware } from "./middleware/middelware";

const app: Express = express();

//registerMiddleware
registerMiddleware(app);

//registerRoutes
registerRoutes(app);

export default app;