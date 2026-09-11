import jwt from "jsonwebtoken";
import { createHash } from "node:crypto";
import { env } from "../config/env.js";

export const signAccessToken = (userId) =>
  jwt.sign({ sub: userId }, env.accessTokenSecret, { expiresIn: env.accessTokenExpires });

export const signRefreshToken = (userId) =>
  jwt.sign({ sub: userId }, env.refreshTokenSecret, { expiresIn: env.refreshTokenExpires });

export const verifyAccessToken = (token) => jwt.verify(token, env.accessTokenSecret);

export const verifyRefreshToken = (token) => jwt.verify(token, env.refreshTokenSecret);

// Refresh tokens are already high-entropy JWTs; hash before storing so a DB
// leak alone can't be replayed as a valid cookie.
export const hashToken = (token) => createHash("sha256").update(token).digest("hex");
