import { Router } from "express";

import { protect } from "../middleware/auth.middleware.js";
import academicYearRoutes from "./academicYear.routes.js";
import authRoutes from "./auth.routes.js";
import classRoutes from "./class.routes.js";
import employeeRoutes from "./employee.routes.js";
import moduleRoutes from "./module.routes.js";
import sectionRoutes from "./section.routes.js";
import studentRoutes from "./student.routes.js";

// Main router: every route file is registered here.
// It is mounted at /api in src/index.ts, so "/auth" becomes "/api/auth".
const router = Router();

// Public: login must work before the user has a token
router.use("/auth", authRoutes);

// Every route below this line requires a logged-in user
router.use(protect);

router.use("/modules", moduleRoutes);
router.use("/classes", classRoutes);
router.use("/sections", sectionRoutes);
router.use("/academic-years", academicYearRoutes);
router.use("/students", studentRoutes);
router.use("/employees", employeeRoutes);
// Add new route files here, e.g.
// router.use("/users", userRoutes);

export default router;
