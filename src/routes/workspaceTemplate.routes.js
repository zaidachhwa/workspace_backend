import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { listWorkspaceTemplates } from "../controllers/workspaceTemplate.controller.js";

const router = Router();
router.get("/", requireAuth, listWorkspaceTemplates);

export default router;
