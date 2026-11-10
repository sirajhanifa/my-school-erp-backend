import { Router } from "express";

import { getAllModules, getModules } from "../controllers/module.controller.js";
import { requireModule } from "../middleware/moduleAccess.middleware.js";

const router = Router();

// Mounted at /api/modules (see routes/index.ts)
// Every logged-in user gets their own (filtered) menu
router.get("/", getModules);
// The full menu is only needed by the Role form, so it needs the "roles" module
router.get("/all", requireModule("roles"), getAllModules);

export default router;
