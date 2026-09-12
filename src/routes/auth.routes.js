import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { loginRateLimit, registerRateLimit } from "../middleware/rateLimit.middleware.js";

const router = Router();

router.post("/register", registerRateLimit, authController.register);
router.post("/login", loginRateLimit, authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);

export default router;
