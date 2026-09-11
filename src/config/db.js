import mongoose from "mongoose";
import { env } from "./env.js";

export const connectDB = async () => {
  mongoose.connection.on("error", (error) => {
    console.error("[db] connection error:", error.message);
  });

  await mongoose.connect(env.mongoUri);
  console.log("[db] connected");
};
