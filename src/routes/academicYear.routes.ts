import { Router } from "express";

import {
  createAcademicYear,
  deleteAcademicYear,
  getAcademicYears,
  updateAcademicYear,
} from "../controllers/academicYear.controller.js";
import { requireModule } from "../middleware/moduleAccess.middleware.js";

const router = Router();

// Mounted at /api/academic-years (see routes/index.ts)
// Every route here needs the "academic-years" module
router.use(requireModule("academic-years"));
router.get("/", getAcademicYears);
router.post("/", createAcademicYear);
router.put("/:id", updateAcademicYear);
router.delete("/:id", deleteAcademicYear);

export default router;
