import { Router } from "express";

import {
  createEmployee,
  deleteEmployee,
  getEmployeeRoles,
  getEmployees,
  updateEmployee,
} from "../controllers/employee.controller.js";
import { requireModule } from "../middleware/moduleAccess.middleware.js";

const router = Router();

// Mounted at /api/employees (see routes/index.ts)
// Every route here needs the "employees" module
router.use(requireModule("employees"));
// "/roles" is before "/:id" routes so it is never read as an id
router.get("/roles", getEmployeeRoles);
router.get("/", getEmployees);
router.post("/", createEmployee);
router.put("/:id", updateEmployee);
router.delete("/:id", deleteEmployee);

export default router;
