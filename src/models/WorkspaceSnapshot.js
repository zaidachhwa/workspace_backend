import mongoose from "mongoose";
import { toJSONPlugin } from "./plugins/toJSON.plugin.js";

const workspaceSnapshotSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    // Server-generated only — never derived from client input (used directly
    // in shell commands for tar/restore, so it must never be attacker-controlled).
    filename: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

toJSONPlugin(workspaceSnapshotSchema, ["filename"]);

export const WorkspaceSnapshot = mongoose.model("WorkspaceSnapshot", workspaceSnapshotSchema);
