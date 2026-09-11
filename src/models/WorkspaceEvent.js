import mongoose from "mongoose";
import { toJSONPlugin } from "./plugins/toJSON.plugin.js";

const workspaceEventSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    eventType: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

workspaceEventSchema.index({ workspace: 1, createdAt: -1 });

toJSONPlugin(workspaceEventSchema);

export const WorkspaceEvent = mongoose.model("WorkspaceEvent", workspaceEventSchema);
