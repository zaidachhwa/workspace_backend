import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { requestId } from "./middleware/requestId.middleware.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.middleware.js";
import apiRoutes from "./routes/index.js";

export const app = express();

// One hop: browser -> nginx -> this backend (127.0.0.1). Without this, every
// request looks like it comes from nginx's own IP, and rate limiting below
// would apply globally across all users combined instead of per real client.
app.set("trust proxy", 1);

app.use(requestId);
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (req, res) => res.json({ success: true, message: "ok" }));
app.use("/api", apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
