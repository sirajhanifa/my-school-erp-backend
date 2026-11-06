import type { Request, Response } from "express";
import mongoose from "mongoose";

import DefaultPassword from "../models/defaultPassword.model.js";
import Role from "../models/role.model.js";
import User from "../models/user.model.js";

// Employees are the users of a school (the users collection).

// Returns the logged-in user's school id (null if the user is missing or inactive).
// Never taken from the request, so users can only touch their own school's employees.
const getSchoolId = async (res: Response) => {
  const user = await User.findById(res.locals.userId).select("schlId isActive");
  if (!user || !user.isActive) return null;
  return user.schlId;
};

// MongoDB error code for "duplicate key" (here: an email that is already used)
const DUPLICATE_KEY_ERROR = 11000;

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === DUPLICATE_KEY_ERROR;

// These roles are not staff, so they cannot be given to an employee
const NON_EMPLOYEE_ROLES = ["student", "parent"];

// Older users have no "deleted" field, so $ne: true also matches them
const notDeleted = { deleted: { $ne: true } };

// Simple email check: something@something.something
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Replace role with { _id, name }, so the list can show the role name
const populateRole = { path: "role", select: "name" };

// What role looks like after populate (null if the role no longer exists)
type NamedRef = { _id: mongoose.Types.ObjectId; name: string } | null;

// The shape of an employee sent to the frontend. Never includes the password.
const toEmployeeResponse = (user: InstanceType<typeof User>) => {
  const role = user.role as unknown as NamedRef;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: role?._id.toString() ?? "",
    roleName: role?.name ?? "",
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

// Checks the request body for create and update.
// Returns { error } with a message for the user, or { data } with the cleaned values to save.
const validateEmployeeBody = async (body: Record<string, unknown>) => {
  const text = (value: unknown) => (value ? String(value).trim() : "");

  const name = text(body.name);
  const email = text(body.email).toLowerCase();
  const roleId = text(body.roleId);

  if (!name) return { error: "Name is required" };
  if (!EMAIL_PATTERN.test(email)) return { error: "Please enter a valid email" };

  // The role must exist, not be deleted, and be a staff role
  const roleExists =
    mongoose.isValidObjectId(roleId) &&
    (await Role.exists({ _id: roleId, deleted: false, name: { $nin: NON_EMPLOYEE_ROLES } }));
  if (!roleExists) return { error: "Please select a valid role" };

  return {
    data: {
      name,
      email,
      role: roleId,
      // Active unless explicitly turned off
      isActive: body.isActive !== false,
    },
  };
};

// GET /api/employees/roles  (the roles an employee can have, for the form's dropdown)
export const getEmployeeRoles = async (_req: Request, res: Response) => {
  try {
    const roles = await Role.find({ deleted: false, name: { $nin: NON_EMPLOYEE_ROLES } })
      .sort({ name: 1 })
      .select("name");

    return res.status(200).json({
      roles: roles.map((role) => ({ id: role.id, name: role.name })),
    });
  } catch (error) {
    console.error("Get employee roles error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// GET /api/employees  (protected: lists the employees of the logged-in user's school)
// Optional filter: ?roleId=...  (missing = all)
export const getEmployees = async (req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    // schlId always comes from the logged-in user, so the filter can never reach another school
    const query: Record<string, unknown> = { schlId, ...notDeleted };

    const { roleId } = req.query;
    if (roleId !== undefined) {
      // A bad id cannot match any employee, so the answer is simply an empty list
      if (!mongoose.isValidObjectId(roleId)) {
        return res.status(200).json({ employees: [] });
      }
      query.role = roleId;
    }

    const employees = await User.find(query)
      .collation({ locale: "en" })
      .sort({ name: 1 })
      .populate(populateRole);

    return res.status(200).json({ employees: employees.map(toEmployeeResponse) });
  } catch (error) {
    console.error("Get employees error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// POST /api/employees  (the new employee gets the school's default password)
export const createEmployee = async (req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const { error, data } = await validateEmployeeBody(req.body ?? {});
    if (error) {
      return res.status(400).json({ message: error });
    }

    // The password is hidden by default, so ask for it
    const defaultPassword = await DefaultPassword.findOne({ schlId }).select("+password");
    if (!defaultPassword) {
      return res.status(500).json({
        message: "Default password is not set for this school. Please contact the administrator.",
      });
    }

    // User's pre("save") hook hashes the password, same as every other user
    const employee = await User.create({ schlId, ...data, password: defaultPassword.password });
    await employee.populate(populateRole);

    return res.status(201).json({
      message: "Employee created successfully",
      employee: toEmployeeResponse(employee),
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res
        .status(409)
        .json({ message: "An employee with this email already exists" });
    }
    console.error("Create employee error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// PUT /api/employees/:id  (the password is never changed here)
export const updateEmployee = async (req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const { id } = req.params;

    // An invalid id cannot match any employee, so treat it as "not found"
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const { error, data } = await validateEmployeeBody(req.body ?? {});
    if (error || !data) {
      return res.status(400).json({ message: error });
    }

    // Stops the logged-in user from locking themselves out
    if (id === res.locals.userId && !data.isActive) {
      return res.status(400).json({ message: "You cannot deactivate your own account" });
    }

    // Filtering by schlId too makes sure a user can only update their own school's employee
    const employee = await User.findOneAndUpdate(
      { _id: id, schlId, ...notDeleted },
      data,
      // new: return the updated document; runValidators: apply the schema rules on update too
      { new: true, runValidators: true },
    ).populate(populateRole);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    return res.status(200).json({
      message: "Employee updated successfully",
      employee: toEmployeeResponse(employee),
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res
        .status(409)
        .json({ message: "An employee with this email already exists" });
    }
    console.error("Update employee error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// DELETE /api/employees/:id  (soft delete; also made inactive, so they can no longer log in)
export const deleteEmployee = async (req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Employee not found" });
    }

    if (id === res.locals.userId) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    const employee = await User.findOneAndUpdate(
      { _id: id, schlId, ...notDeleted },
      { deleted: true, isActive: false },
    );

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    return res.status(200).json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Delete employee error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};
