import { Router } from "express";

import {
  createRole,
  deleteRole,
  getRoles,
  updateRole,
} from "../controllers/role.controller.js";
import { requireModule } from "../middleware/moduleAccess.middleware.js";

const router = Router();

// Mounted at /api/roles (see routes/index.ts)
// Every route here needs the "roles" module
router.use(requireModule("roles"));
router.get("/", getRoles);
router.post("/", createRole);
router.put("/:id", updateRole);
router.delete("/:id", deleteRole);

export default router;
