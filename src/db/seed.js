import { connectDB } from "../config/db.js";
import { WorkspaceTemplate } from "../models/WorkspaceTemplate.js";
import mongoose from "mongoose";

const templates = [
  { name: "Node.js", image: "cloudworkspace/dev-node:latest", config: { runtime: "node" } },
  { name: "Full Stack (Node + Mongo)", image: "cloudworkspace/dev-node:latest", config: { runtime: "node-mongo" } },
];

await connectDB();

for (const { name, ...fields } of templates) {
  await WorkspaceTemplate.updateOne({ name }, { $set: fields }, { upsert: true });
}

console.log(`[seed] ensured ${templates.length} workspace templates`);
await mongoose.disconnect();
