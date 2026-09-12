import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import * as adminController from "../controllers/admin.controller.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/users", adminController.listUsers);
router.patch("/users/:id", adminController.updateUser);

export default router;
