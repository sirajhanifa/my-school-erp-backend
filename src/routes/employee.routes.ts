import { Router } from "express";

import {
  createEmployee,
  deleteEmployee,
  getEmployeeRoles,
  getEmployees,
  updateEmployee,
} from "../controllers/employee.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

// Mounted at /api/employees (see routes/index.ts)
// "/roles" is before "/:id" routes so it is never read as an id
router.get("/roles", protect, getEmployeeRoles);
router.get("/", protect, getEmployees);
router.post("/", protect, createEmployee);
router.put("/:id", protect, updateEmployee);
router.delete("/:id", protect, deleteEmployee);

export default router;
