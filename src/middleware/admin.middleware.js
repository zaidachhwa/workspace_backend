import { User } from "../models/User.js";
import { USER_ROLE } from "../constants/user.constants.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Runs after requireAuth. A real DB lookup (not just trusting the JWT) since
// admin routes are low-traffic and a role change should take effect
// immediately, not wait for the current access token to expire.
export const requireAdmin = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user || user.role !== USER_ROLE.ADMIN) {
    throw new ApiError(403, "Admin access required");
  }
  next();
});
