import { Router } from "express";

import authRoutes from "./auth.routes.js";

// Main router: every route file is registered here.
// It is mounted at /api in src/index.ts, so "/auth" becomes "/api/auth".
const router = Router();

router.use("/auth", authRoutes);
// Add new route files here, e.g.
// router.use("/users", userRoutes);

export default router;
