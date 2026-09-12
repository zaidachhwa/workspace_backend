import mongoose from "mongoose";
import { toJSONPlugin } from "./plugins/toJSON.plugin.js";
import { USER_ROLE, USER_ROLES, DEFAULT_WORKSPACE_QUOTA } from "../constants/user.constants.js";

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
    role: { type: String, enum: USER_ROLES, default: USER_ROLE.USER },
    // Only counts workspaces this user OWNS — being a collaborator on
    // someone else's shared workspace never counts against your own quota.
    workspaceQuota: { type: Number, default: DEFAULT_WORKSPACE_QUOTA },
    disabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

toJSONPlugin(userSchema, ["passwordHash", "refreshTokens"]);

export const User = mongoose.model("User", userSchema);
