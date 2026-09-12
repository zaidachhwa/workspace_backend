import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { parseDurationMs } from "../utils/duration.js";
import { env } from "../config/env.js";
import { USER_ROLE } from "../constants/user.constants.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from "./token.service.js";

const SALT_ROUNDS = 12;

// No manual DB editing needed to bootstrap an admin — matching ADMIN_EMAILS
// gets promoted automatically. Idempotent, and only ever promotes, never
// silently demotes (removing an email from the list doesn't strip an
// existing admin's role — do that explicitly via another admin instead).
const syncAdminRole = async (user) => {
  if (user.role !== USER_ROLE.ADMIN && env.adminEmails.includes(user.email)) {
    user.role = USER_ROLE.ADMIN;
    await user.save();
  }
};

export const registerUser = async ({ name, email, password }) => {
  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, "An account with this email already exists");

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ name, email, passwordHash });
  await syncAdminRole(user);
  return user;
};

export const validateCredentials = async (email, password) => {
  const user = await User.findOne({ email });
  if (!user?.passwordHash) throw new ApiError(401, "Invalid email or password");

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) throw new ApiError(401, "Invalid email or password");

  if (user.disabled) throw new ApiError(403, "This account has been disabled");

  await syncAdminRole(user);
  return user;
};

export const issueTokenPair = async (user) => {
  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);

  user.refreshTokens.push({
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + parseDurationMs(env.refreshTokenExpires)),
  });
  // Prune expired entries so the array doesn't grow unbounded across devices/sessions.
  user.refreshTokens = user.refreshTokens.filter((t) => t.expiresAt > new Date());
  await user.save();

  return { accessToken, refreshToken };
};

export const rotateRefreshToken = async (refreshToken) => {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, "Invalid or expired session");
  }

  const user = await User.findById(payload.sub);
  const tokenHash = hashToken(refreshToken);
  const stored = user?.refreshTokens.find((t) => t.tokenHash === tokenHash);
  if (!user || !stored || stored.expiresAt < new Date()) {
    throw new ApiError(401, "Invalid or expired session");
  }

  user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== tokenHash);
  await user.save();

  return issueTokenPair(user);
};

export const revokeRefreshToken = async (userId, refreshToken) => {
  const user = await User.findById(userId);
  if (!user) return;

  const tokenHash = hashToken(refreshToken);
  user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== tokenHash);
  await user.save();
};
