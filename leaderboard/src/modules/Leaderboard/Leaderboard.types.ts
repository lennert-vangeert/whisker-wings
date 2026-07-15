import { Document } from "mongoose";

export type Leaderboard = Document & {
  _id?: string;
  userName: string;
  score: string;
};
