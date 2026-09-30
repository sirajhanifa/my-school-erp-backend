import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

// Protects routes: only lets the request through if it has a valid JWT cookie.
// Usage: router.get("/something", protect, controller)
export const protect = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: "Not logged in" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };

    // Make the logged-in user's id available to the next controller
    res.locals.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ message: "Session expired. Please log in again." });
  }
};
