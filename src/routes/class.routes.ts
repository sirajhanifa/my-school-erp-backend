import { Router } from "express";

import {
  createClass,
  deleteClass,
  getClasses,
  updateClass,
} from "../controllers/class.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

// Mounted at /api/classes (see routes/index.ts)
router.get("/", protect, getClasses);
router.post("/", protect, createClass);
router.put("/:id", protect, updateClass);
router.delete("/:id", protect, deleteClass);

export default router;
