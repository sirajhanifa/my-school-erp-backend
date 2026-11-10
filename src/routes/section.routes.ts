import { Router } from "express";

import {
  createSection,
  deleteSection,
  getSections,
  updateSection,
} from "../controllers/section.controller.js";
import { requireModule } from "../middleware/moduleAccess.middleware.js";

const router = Router();

// Mounted at /api/sections (see routes/index.ts)
// The Students page also reads the section list (filter and form), so "students" may read it too.
// Only the "sections" module may change sections.
router.get("/", requireModule("sections", "students"), getSections);
router.post("/", requireModule("sections"), createSection);
router.put("/:id", requireModule("sections"), updateSection);
router.delete("/:id", requireModule("sections"), deleteSection);

export default router;
