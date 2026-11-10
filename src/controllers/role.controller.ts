import type { Request, Response } from "express";
import mongoose from "mongoose";

import { FULL_ACCESS_ROLE } from "../middleware/moduleAccess.middleware.js";
import Module from "../models/module.model.js";
import Role from "../models/role.model.js";
import User from "../models/user.model.js";

// A valid token alone is not enough: the user must still exist and be active
const isActiveUser = async (res: Response) => {
  const user = await User.findById(res.locals.userId).select("isActive");
  return !!user && user.isActive;
};

// MongoDB error code for "duplicate key" (here: a role name that already exists)
const DUPLICATE_KEY_ERROR = 11000;

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === DUPLICATE_KEY_ERROR;

// Role names are stored in lowercase, so "Admin" and "admin" count as the same role
const cleanName = (name: unknown) => (name ? String(name).trim().toLowerCase() : "");

// Codes of the pages in the logged-in user's school menu. A role may only be given these.
const getMenuCodes = async (res: Response) => {
  const user = await User.findById(res.locals.userId).select("schlId");
  const menuDoc = user ? await Module.findOne({ schlId: user.schlId }) : null;

  const codes = new Set<string>();
  for (const mainMenu of menuDoc?.modules ?? []) {
    if (mainMenu.deleted) continue;
    // A main menu with a path is a page itself (e.g. Dashboard); otherwise only its submenus are
    if (mainMenu.path) codes.add(mainMenu.code);
    for (const subMenu of mainMenu.subMenus) {
      if (!subMenu.deleted) codes.add(subMenu.code);
    }
  }
  return codes;
};

// Checks the "modules" sent for a role. Returns the cleaned codes; error is "" when they are fine.
// The superadmin role always has full access, so it stores no list.
const cleanModules = async (
  res: Response,
  roleName: string,
  value: unknown,
): Promise<{ modules: string[]; error: string }> => {
  if (roleName === FULL_ACCESS_ROLE) return { modules: [], error: "" };

  if (!Array.isArray(value) || value.length === 0) {
    return { modules: [], error: "Please select at least one module" };
  }

  const validCodes = await getMenuCodes(res);
  // new Set removes duplicates
  const modules = [...new Set(value.map((code) => String(code).trim().toLowerCase()))];

  if (!modules.every((code) => validCodes.has(code))) {
    return { modules: [], error: "Please select valid modules" };
  }
  return { modules, error: "" };
};

// The shape of a role sent to the frontend
const toRoleResponse = (role: InstanceType<typeof Role>) => ({
  id: role.id,
  name: role.name,
  description: role.description ?? "",
  modules: [...role.modules],
  createdAt: role.createdAt,
  updatedAt: role.updatedAt,
});

// GET /api/roles  (deleted roles are hidden)
export const getRoles = async (_req: Request, res: Response) => {
  try {
    if (!(await isActiveUser(res))) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const roles = await Role.find({ deleted: false }).sort({ name: 1 });

    return res.status(200).json({ roles: roles.map(toRoleResponse) });
  } catch (error) {
    console.error("Get roles error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// POST /api/roles
export const createRole = async (req: Request, res: Response) => {
  try {
    if (!(await isActiveUser(res))) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const { name, description, modules } = req.body ?? {};
    const roleName = cleanName(name);

    if (!roleName) {
      return res.status(400).json({ message: "Role name is required" });
    }

    const access = await cleanModules(res, roleName, modules);
    if (access.error) {
      return res.status(400).json({ message: access.error });
    }

    const role = await Role.create({
      name: roleName,
      description: description ? String(description) : "",
      modules: access.modules,
    });

    return res
      .status(201)
      .json({ message: "Role created successfully", role: toRoleResponse(role) });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res
        .status(409)
        .json({ message: "A role with this name already exists" });
    }
    console.error("Create role error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// PUT /api/roles/:id
export const updateRole = async (req: Request, res: Response) => {
  try {
    if (!(await isActiveUser(res))) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const { id } = req.params;
    const { name, description, modules } = req.body ?? {};
    const roleName = cleanName(name);

    // An invalid id cannot match any role, so treat it as "not found"
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Role not found" });
    }

    if (!roleName) {
      return res.status(400).json({ message: "Role name is required" });
    }

    // Full access depends on the name "superadmin", so renaming it would lock everyone out
    const isFullAccessRole = await Role.exists({ _id: id, deleted: false, name: FULL_ACCESS_ROLE });
    if (isFullAccessRole && roleName !== FULL_ACCESS_ROLE) {
      return res.status(400).json({ message: "The superadmin role cannot be renamed" });
    }

    const access = await cleanModules(res, roleName, modules);
    if (access.error) {
      return res.status(400).json({ message: access.error });
    }

    const role = await Role.findOneAndUpdate(
      { _id: id, deleted: false },
      {
        name: roleName,
        description: description ? String(description) : "",
        modules: access.modules,
      },
      // new: return the updated document; runValidators: apply the schema rules on update too
      { new: true, runValidators: true },
    );

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    return res
      .status(200)
      .json({ message: "Role updated successfully", role: toRoleResponse(role) });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res
        .status(409)
        .json({ message: "A role with this name already exists" });
    }
    console.error("Update role error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// DELETE /api/roles/:id  (soft delete: the role is only marked as deleted)
export const deleteRole = async (req: Request, res: Response) => {
  try {
    if (!(await isActiveUser(res))) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Role not found" });
    }

    // The superadmin role gives full access, so it must always exist
    if (await Role.exists({ _id: id, deleted: false, name: FULL_ACCESS_ROLE })) {
      return res.status(400).json({ message: "The superadmin role cannot be deleted" });
    }

    // Users holding a deleted role could not be saved from the Employee form
    const isInUse = await User.exists({ role: String(id), deleted: { $ne: true } });
    if (isInUse) {
      return res
        .status(409)
        .json({ message: "This role is assigned to users, so it cannot be deleted" });
    }

    const role = await Role.findOneAndUpdate(
      { _id: id, deleted: false },
      { deleted: true },
    );

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    return res.status(200).json({ message: "Role deleted successfully" });
  } catch (error) {
    console.error("Delete role error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};
