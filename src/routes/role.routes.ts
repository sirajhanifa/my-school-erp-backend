import { Router } from "express";

import {
  createRole,
  deleteRole,
  getRoles,
  updateRole,
} from "../controllers/role.controller.js";

const router = Router();

// Mounted at /api/roles (see routes/index.ts)
router.get("/", getRoles);
router.post("/", createRole);
router.put("/:id", updateRole);
router.delete("/:id", deleteRole);

export default router;
