import { verifyAccessToken } from "../services/token.service.js";
import { ApiError } from "../utils/ApiError.js";

export const requireAuth = (req, res, next) => {
  const token = req.cookies?.accessToken;
  if (!token) {
    return next(new ApiError(401, "Authentication required"));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub };
    next();
  } catch {
    next(new ApiError(401, "Invalid or expired session"));
  }
};
