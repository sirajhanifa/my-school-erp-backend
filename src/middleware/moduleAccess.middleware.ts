import type { NextFunction, Request, Response } from "express";

import User from "../models/user.model.js";

// The superadmin role can always open every module, so it can never be locked out
export const FULL_ACCESS_ROLE = "superadmin";

// The user's role after populate (null if the role no longer exists)
type RoleAccess = { name: string; modules: string[]; deleted: boolean } | null;

// Loads the logged-in user with their role. Returns null if the user is missing, inactive or deleted.
// Read fresh on every request, so a role change applies straight away.
export const loadUserAccess = async (userId: unknown) => {
  const user = await User.findById(userId)
    .select("schlId isActive deleted role")
    .populate<{ role: RoleAccess }>("role", "name modules deleted");

  if (!user || !user.isActive || user.deleted) return null;
  return user;
};

// true if the role may open the module with this code
export const hasModuleAccess = (role: RoleAccess, code: string) =>
  !!role && !role.deleted && (role.name === FULL_ACCESS_ROLE || role.modules.includes(code));

// Lets the request through only if the user's role has at least one of these modules.
// Usage: router.get("/", requireModule("classes", "students"), getClasses)
export const requireModule =
  (...codes: string[]) =>
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await loadUserAccess(res.locals.userId);

      if (!user) {
        return res
          .status(401)
          .json({ message: "User not found. Please log in again." });
      }

      if (!codes.some((code) => hasModuleAccess(user.role, code))) {
        return res
          .status(403)
          .json({ message: "You do not have access to this module" });
      }

      next();
    } catch (error) {
      console.error("Module access error:", error);
      return res
        .status(500)
        .json({ message: "Something went wrong. Please try again." });
    }
  };
