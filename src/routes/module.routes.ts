import { Router } from "express";

import { getModules } from "../controllers/module.controller.js";

const router = Router();

// Mounted at /api/modules (see routes/index.ts)
router.get("/", getModules);

export default router;
