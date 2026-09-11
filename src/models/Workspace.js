import mongoose from "mongoose";
import { WORKSPACE_STATUS, WORKSPACE_STATUSES } from "../constants/workspace.constants.js";
import { toJSONPlugin } from "./plugins/toJSON.plugin.js";

// Environment values are AES-256-GCM encrypted before storage; never store plaintext.
const environmentVariableSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    encryptedValue: { type: String, required: true },
  },
  { _id: false }
);

const workspaceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    status: { type: String, enum: WORKSPACE_STATUSES, default: WORKSPACE_STATUS.CREATING },
    template: { type: mongoose.Schema.Types.ObjectId, ref: "WorkspaceTemplate", required: true },
    containerId: { type: String, default: null },
    // Routed by Traefik via Docker labels (see docker.service.js) — the
    // workspace container publishes no host port itself.
    accessDomain: { type: String, default: null },
    accessPasswordEncrypted: { type: String, default: null },
    cpuLimit: { type: Number, required: true },
    memoryLimitMb: { type: Number, required: true },
    storageLimitMb: { type: Number, required: true },
    environment: { type: [environmentVariableSchema], default: [] },
    lastStartedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// environment holds encrypted ciphertext — never serialize it; clients get
// key names only, via the dedicated /environment endpoint.
toJSONPlugin(workspaceSchema, ["environment", "accessPasswordEncrypted"]);

export const Workspace = mongoose.model("Workspace", workspaceSchema);
