import { Router } from "express";

import {
  createAcademicYear,
  deleteAcademicYear,
  getAcademicYears,
  updateAcademicYear,
} from "../controllers/academicYear.controller.js";

const router = Router();

// Mounted at /api/academic-years (see routes/index.ts)
router.get("/", getAcademicYears);
router.post("/", createAcademicYear);
router.put("/:id", updateAcademicYear);
router.delete("/:id", deleteAcademicYear);

export default router;
