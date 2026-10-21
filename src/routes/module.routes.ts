import { Router } from "express";

import { getModules } from "../controllers/module.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

// Mounted at /api/modules (see routes/index.ts)
router.get("/", protect, getModules);

export default router;
