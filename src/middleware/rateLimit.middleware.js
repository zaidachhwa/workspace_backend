import rateLimit from "express-rate-limit";

// Per-IP. Keyed by IP rather than email/account, since the point is
// slowing down credential-guessing before we even know which account
// is being targeted.
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Try again in a few minutes." },
});

export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many accounts created from this address. Try again later." },
});
