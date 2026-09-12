import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { me } from "../controllers/auth.controller.js";
import authRoutes from "./auth.routes.js";
import workspaceRoutes from "./workspace.routes.js";
import workspaceTemplateRoutes from "./workspaceTemplate.routes.js";
import adminRoutes from "./admin.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.get("/me", requireAuth, me);
router.use("/workspaces", workspaceRoutes);
router.use("/workspace-templates", workspaceTemplateRoutes);
router.use("/admin", adminRoutes);

export default router;
