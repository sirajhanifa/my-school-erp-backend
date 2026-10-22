import { Router } from "express";

import authRoutes from "./auth.routes.js";
import classRoutes from "./class.routes.js";
import moduleRoutes from "./module.routes.js";

// Main router: every route file is registered here.
// It is mounted at /api in src/index.ts, so "/auth" becomes "/api/auth".
const router = Router();

router.use("/auth", authRoutes);
router.use("/modules", moduleRoutes);
router.use("/classes", classRoutes);
// Add new route files here, e.g.
// router.use("/users", userRoutes);

export default router;
