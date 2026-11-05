import { Router } from "express";

import {
  createStudent,
  deleteStudent,
  getStudents,
  updateStudent,
} from "../controllers/student.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

// Mounted at /api/students (see routes/index.ts)
router.get("/", protect, getStudents);
router.post("/", protect, createStudent);
router.put("/:id", protect, updateStudent);
router.delete("/:id", protect, deleteStudent);

export default router;
