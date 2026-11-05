import { Router } from "express";

import {
  createSection,
  deleteSection,
  getSections,
  updateSection,
} from "../controllers/section.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

// Mounted at /api/sections (see routes/index.ts)
router.get("/", protect, getSections);
router.post("/", protect, createSection);
router.put("/:id", protect, updateSection);
router.delete("/:id", protect, deleteSection);

export default router;
