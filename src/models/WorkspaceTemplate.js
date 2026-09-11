import mongoose from "mongoose";
import { toJSONPlugin } from "./plugins/toJSON.plugin.js";

const workspaceTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    image: { type: String, required: true },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

toJSONPlugin(workspaceTemplateSchema);

export const WorkspaceTemplate = mongoose.model("WorkspaceTemplate", workspaceTemplateSchema);
