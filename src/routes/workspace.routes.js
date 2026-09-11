import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import * as workspaceController from "../controllers/workspace.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/", workspaceController.listWorkspaces);
router.post("/", workspaceController.createWorkspace);
router.get("/:id", workspaceController.getWorkspace);
router.patch("/:id", workspaceController.updateWorkspace);
router.delete("/:id", workspaceController.deleteWorkspace);

router.post("/:id/start", workspaceController.startWorkspace);
router.post("/:id/stop", workspaceController.stopWorkspace);
router.post("/:id/restart", workspaceController.restartWorkspace);
router.get("/:id/status", workspaceController.getWorkspaceStatus);
router.get("/:id/events", workspaceController.listWorkspaceEvents);

router.get("/:id/environment", workspaceController.listEnvironmentKeys);
router.post("/:id/environment", workspaceController.setEnvironmentVariable);
router.delete("/:id/environment/:key", workspaceController.removeEnvironmentVariable);

export default router;
