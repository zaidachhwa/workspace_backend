import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { registerSchema, loginSchema } from "../validators/auth.validator.js";
import { env } from "../config/env.js";
import * as authService from "../services/auth.service.js";
import { verifyRefreshToken } from "../services/token.service.js";
import { User } from "../models/User.js";

const cookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: "lax",
  path: "/",
};

const setAuthCookies = (res, { accessToken, refreshToken }) => {
  res.cookie("accessToken", accessToken, cookieOptions);
  res.cookie("refreshToken", refreshToken, cookieOptions);
};

const clearAuthCookies = (res) => {
  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);
};

export const register = asyncHandler(async (req, res) => {
  const input = await registerSchema.validate(req.body, { abortEarly: true, stripUnknown: true });
  const user = await authService.registerUser(input);
  const tokens = await authService.issueTokenPair(user);
  setAuthCookies(res, tokens);
  sendSuccess(res, {
    status: 201,
    message: "Account created",
    data: user,
  });
});

export const login = asyncHandler(async (req, res) => {
  const input = await loginSchema.validate(req.body, { abortEarly: true, stripUnknown: true });
  const user = await authService.validateCredentials(input.email, input.password);
  const tokens = await authService.issueTokenPair(user);
  setAuthCookies(res, tokens);
  sendSuccess(res, { message: "Logged in", data: user });
});

export const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) throw new ApiError(401, "Authentication required");

  const tokens = await authService.rotateRefreshToken(refreshToken);
  setAuthCookies(res, tokens);
  sendSuccess(res, { message: "Session refreshed" });
});

export const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) {
    try {
      const { sub: userId } = verifyRefreshToken(refreshToken);
      await authService.revokeRefreshToken(userId, refreshToken);
    } catch {
      // Token already invalid/expired — nothing to revoke, just clear cookies below.
    }
  }
  clearAuthCookies(res);
  sendSuccess(res, { message: "Logged out" });
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");
  sendSuccess(res, { data: user });
});
