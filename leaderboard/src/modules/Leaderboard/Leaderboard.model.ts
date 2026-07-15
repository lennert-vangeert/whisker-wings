import mongoose from "mongoose";
import validateModel from "../../validation/validateModel";
import { Leaderboard } from "./Leaderboard.types";

const leaderboardSchema = new mongoose.Schema<Leaderboard>(
  {
    userName: {
      type: String,
      required: true,
    },
    score: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

//date format
// YYYY-MM-DD

leaderboardSchema.pre("save", function (next) {
  validateModel(this);
  next();
});

const LeaderboardModel = mongoose.model<Leaderboard>(
  "Leaderboard",
  leaderboardSchema
);

export default LeaderboardModel;
