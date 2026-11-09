import { Router } from "express";

import {
  createClass,
  deleteClass,
  getClasses,
  updateClass,
} from "../controllers/class.controller.js";

const router = Router();

// Mounted at /api/classes (see routes/index.ts)
router.get("/", getClasses);
router.post("/", createClass);
router.put("/:id", updateClass);
router.delete("/:id", deleteClass);

export default router;
