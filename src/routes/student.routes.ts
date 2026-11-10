import { Router } from "express";

import {
  createStudent,
  deleteStudent,
  downloadStudentTemplate,
  getStudents,
  importStudents,
  updateStudent,
} from "../controllers/student.controller.js";
import { requireModule } from "../middleware/moduleAccess.middleware.js";
import { uploadExcel } from "../middleware/upload.middleware.js";

const router = Router();

// Mounted at /api/students (see routes/index.ts)
// Every route here needs the "students" module
router.use(requireModule("students"));
router.get("/", getStudents);
router.post("/", createStudent);
// Excel import (registered before "/:id" routes, so "import" is never read as an id)
router.get("/import/template", downloadStudentTemplate);
router.post("/import", uploadExcel, importStudents);
router.put("/:id", updateStudent);
router.delete("/:id", deleteStudent);

export default router;
