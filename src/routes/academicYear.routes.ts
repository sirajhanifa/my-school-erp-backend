import { Router } from "express";

import {
  createAcademicYear,
  deleteAcademicYear,
  getAcademicYears,
  updateAcademicYear,
} from "../controllers/academicYear.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

// Mounted at /api/academic-years (see routes/index.ts)
router.get("/", protect, getAcademicYears);
router.post("/", protect, createAcademicYear);
router.put("/:id", protect, updateAcademicYear);
router.delete("/:id", protect, deleteAcademicYear);

export default router;
