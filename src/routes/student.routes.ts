import { Router } from "express";

import {
  createStudent,
  deleteStudent,
  getStudents,
  updateStudent,
} from "../controllers/student.controller.js";

const router = Router();

// Mounted at /api/students (see routes/index.ts)
router.get("/", getStudents);
router.post("/", createStudent);
router.put("/:id", updateStudent);
router.delete("/:id", deleteStudent);

export default router;
