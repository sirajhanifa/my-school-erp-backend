import type { Request, Response } from "express";

import Module from "../models/module.model.js";
import User from "../models/user.model.js";

// GET /api/modules  (protected: returns the menu of the logged-in user's school)
export const getModules = async (_req: Request, res: Response) => {
  try {
    // 1. Find the user's school.
    // The school always comes from the logged-in user, never from the request,
    // so a user can only ever see their own school's menu.
    const user = await User.findById(res.locals.userId).select("schlId isActive");

    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    // 2. Load that school's menu document
    const menuDoc = await Module.findOne({ schlId: user.schlId });

    // A school without a menu document simply has no modules yet
    if (!menuDoc) {
      return res.status(200).json({ modules: [] });
    }

    // 3. Keep only active, not-deleted menus, sorted by order (lowest first).
    // If a main menu is hidden, its submenus are hidden with it.
    // Menus with the same order keep their array order, because JS sort is stable.
    const modules = menuDoc.modules
      .filter((mainMenu) => mainMenu.isActive && !mainMenu.deleted)
      .sort((a, b) => a.order - b.order)
      .map((mainMenu) => ({
        id: mainMenu._id.toString(),
        name: mainMenu.name,
        code: mainMenu.code,
        icon: mainMenu.icon,
        path: mainMenu.path,
        order: mainMenu.order,
        subMenus: mainMenu.subMenus
          .filter((subMenu) => subMenu.isActive && !subMenu.deleted)
          .sort((a, b) => a.order - b.order)
          .map((subMenu) => ({
            id: subMenu._id.toString(),
            name: subMenu.name,
            code: subMenu.code,
            icon: subMenu.icon,
            path: subMenu.path,
            order: subMenu.order,
          })),
      }));

    return res.status(200).json({ modules });
  } catch (error) {
    console.error("Get modules error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};
