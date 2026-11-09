import { rateLimit } from "express-rate-limit";

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 3, // Maximum 3 failed attempts per IP
  skipSuccessfulRequests: true, // Only failed logins count towards the limit
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
});

export default loginRateLimiter;
