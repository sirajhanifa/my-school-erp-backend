import { Router } from "express";

import { getMe, login, logout } from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import loginRateLimiter from "../middleware/rateLimiter.middleware.js";

const router = Router();

router.post("/login", loginRateLimiter, login);
router.post("/logout", logout);
router.get("/me", protect, getMe);

export default router;
