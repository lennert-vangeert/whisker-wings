import compression from "compression";
import cors from "cors";
import express, { Express, Request, Response, NextFunction } from "express";
import helmet from "helmet";

const registerMiddleware = (app: Express) => {
  //cors

  const corsOptions = {
    allowedHeaders: ["Content-Type", "key"], // Add custom headers
  };
  app.use(cors(corsOptions));

  //json parser
  app.use(express.json());

  //helmet
  app.use(helmet.noSniff());
  app.use(helmet.hidePoweredBy());
  app.use(helmet.xssFilter());

  //compression
  app.use(compression());
};

const verifyApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers["key"];
  const validApiKey = process.env.KEY;

  if (apiKey !== validApiKey) {
    return res.status(403).json({ message: "Forbidden: Invalid API Key" });
  }
  next();
};

export { registerMiddleware, verifyApiKey };
