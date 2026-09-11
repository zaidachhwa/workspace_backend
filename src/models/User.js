import mongoose from "mongoose";
import { toJSONPlugin } from "./plugins/toJSON.plugin.js";

const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    refreshTokens: { type: [refreshTokenSchema], default: [] },
  },
  { timestamps: true }
);

toJSONPlugin(userSchema, ["passwordHash", "refreshTokens"]);

export const User = mongoose.model("User", userSchema);
