import { connectDB } from "../config/db.js";
import { WorkspaceTemplate } from "../models/WorkspaceTemplate.js";
import mongoose from "mongoose";

const templates = [
  {
    name: "General Purpose",
    image: "cloudworkspace/dev-node:latest",
    config: { runtime: "node-python" },
  },
  {
    name: "Full Stack (Node + Python + Mongo)",
    image: "cloudworkspace/dev-fullstack:latest",
    config: { runtime: "node-python-mongo", mongoUri: "mongodb://127.0.0.1:27017" },
  },
];

await connectDB();

for (const { name, ...fields } of templates) {
  await WorkspaceTemplate.updateOne({ name }, { $set: fields }, { upsert: true });
}

// Renamed from the old names — remove the stale entries so they don't
// linger as duplicate/dead options in the template dropdown.
await WorkspaceTemplate.deleteMany({ name: { $in: ["Node.js", "Full Stack (Node + Mongo)"] } });

console.log(`[seed] ensured ${templates.length} workspace templates`);
await mongoose.disconnect();
