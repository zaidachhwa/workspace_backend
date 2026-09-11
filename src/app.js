import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { requestId } from "./middleware/requestId.middleware.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.middleware.js";
import apiRoutes from "./routes/index.js";

export const app = express();

app.use(requestId);
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (req, res) => res.json({ success: true, message: "ok" }));
app.use("/api", apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
