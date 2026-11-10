import type { Request, Response } from "express";

import {
  hasModuleAccess,
  loadUserAccess,
} from "../middleware/moduleAccess.middleware.js";
import Module from "../models/module.model.js";

// Turns a school's menu document into the menu sent to the frontend.
// Keeps only active, not-deleted items that canOpen allows, sorted by order (lowest first).
// A hidden main menu hides its submenus too.
const buildMenu = (
  menuDoc: InstanceType<typeof Module>,
  canOpen: (code: string) => boolean,
) =>
  menuDoc.modules
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
        .filter((subMenu) => subMenu.isActive && !subMenu.deleted && canOpen(subMenu.code))
        .sort((a, b) => a.order - b.order)
        .map((subMenu) => ({
          id: subMenu._id.toString(),
          name: subMenu.name,
          code: subMenu.code,
          icon: subMenu.icon,
          path: subMenu.path,
          order: subMenu.order,
        })),
    }))
    // Keep a group only if a submenu is left, and a link (e.g. Dashboard) only if it is allowed.
    // An empty group would otherwise show up as a link with no page.
    .filter((mainMenu) =>
      mainMenu.subMenus.length > 0 || (!!mainMenu.path && canOpen(mainMenu.code)),
    );

// GET /api/modules  (protected: the logged-in user's school menu, only the modules their role allows)
export const getModules = async (_req: Request, res: Response) => {
  try {
    // The school comes from the logged-in user, never from the request,
    // so a user can only see their own school's menu.
    const user = await loadUserAccess(res.locals.userId);

    if (!user) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    // A school without a menu document simply has no modules yet
    const menuDoc = await Module.findOne({ schlId: user.schlId });
    if (!menuDoc) {
      return res.status(200).json({ modules: [] });
    }

    const modules = buildMenu(menuDoc, (code) => hasModuleAccess(user.role, code));
    return res.status(200).json({ modules });
  } catch (error) {
    console.error("Get modules error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// GET /api/modules/all  (the school's full menu, for the module checkboxes on the Role form)
export const getAllModules = async (_req: Request, res: Response) => {
  try {
    const user = await loadUserAccess(res.locals.userId);

    if (!user) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const menuDoc = await Module.findOne({ schlId: user.schlId });
    if (!menuDoc) {
      return res.status(200).json({ modules: [] });
    }

    return res.status(200).json({ modules: buildMenu(menuDoc, () => true) });
  } catch (error) {
    console.error("Get all modules error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};
