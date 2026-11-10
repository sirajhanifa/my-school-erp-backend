import { Router } from "express";

import {
  createClass,
  deleteClass,
  getClasses,
  updateClass,
} from "../controllers/class.controller.js";
import { requireModule } from "../middleware/moduleAccess.middleware.js";

const router = Router();

// Mounted at /api/classes (see routes/index.ts)
// The Students page also reads the class list (filter and form), so "students" may read it too.
// Only the "classes" module may change classes.
router.get("/", requireModule("classes", "students"), getClasses);
router.post("/", requireModule("classes"), createClass);
router.put("/:id", requireModule("classes"), updateClass);
router.delete("/:id", requireModule("classes"), deleteClass);

export default router;
