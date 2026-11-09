import { Router } from "express";

import {
  createSection,
  deleteSection,
  getSections,
  updateSection,
} from "../controllers/section.controller.js";

const router = Router();

// Mounted at /api/sections (see routes/index.ts)
router.get("/", getSections);
router.post("/", createSection);
router.put("/:id", updateSection);
router.delete("/:id", deleteSection);

export default router;
