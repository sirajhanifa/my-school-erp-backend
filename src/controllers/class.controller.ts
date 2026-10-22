import type { Request, Response } from "express";
import mongoose from "mongoose";

import Class from "../models/class.model.js";
import User from "../models/user.model.js";

// Returns the school id of the logged-in user, or null if the user is missing or inactive.
// The school always comes from the logged-in user, never from the request,
// so a user can only ever see and change their own school's classes.
const getSchoolId = async (res: Response) => {
  const user = await User.findById(res.locals.userId).select("schlId isActive");
  if (!user || !user.isActive) return null;
  return user.schlId;
};

// MongoDB error code for "duplicate key" (here: same class name twice in one school)
const DUPLICATE_KEY_ERROR = 11000;

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === DUPLICATE_KEY_ERROR;

// The shape of a class sent to the frontend
const toClassResponse = (cls: InstanceType<typeof Class>) => ({
  id: cls.id,
  name: cls.name,
  description: cls.description,
  createdAt: cls.createdAt,
  updatedAt: cls.updatedAt,
});

// GET /api/classes  (protected: lists the classes of the logged-in user's school)
export const getClasses = async (_req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const classes = await Class.find({ schlId, deleted: false }).sort({ name: 1 });

    return res.status(200).json({ classes: classes.map(toClassResponse) });
  } catch (error) {
    console.error("Get classes error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// POST /api/classes
export const createClass = async (req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const { name, description } = req.body ?? {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Class name is required" });
    }

    const cls = await Class.create({
      schlId,
      name: String(name),
      description: description ? String(description) : "",
    });

    return res
      .status(201)
      .json({ message: "Class created successfully", class: toClassResponse(cls) });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res
        .status(409)
        .json({ message: "A class with this name already exists" });
    }
    console.error("Create class error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// PUT /api/classes/:id
export const updateClass = async (req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const { id } = req.params;
    const { name, description } = req.body ?? {};

    // An invalid id cannot match any class, so treat it as "not found"
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Class not found" });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Class name is required" });
    }

    // Filtering by schlId too makes sure a user can only update their own school's class
    const cls = await Class.findOneAndUpdate(
      { _id: id, schlId, deleted: false },
      {
        name: String(name),
        description: description ? String(description) : "",
      },
      // new: return the updated document; runValidators: apply the schema rules on update too
      { new: true, runValidators: true },
    );

    if (!cls) {
      return res.status(404).json({ message: "Class not found" });
    }

    return res
      .status(200)
      .json({ message: "Class updated successfully", class: toClassResponse(cls) });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res
        .status(409)
        .json({ message: "A class with this name already exists" });
    }
    console.error("Update class error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// DELETE /api/classes/:id  (soft delete: the class is only marked as deleted)
export const deleteClass = async (req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Class not found" });
    }

    const cls = await Class.findOneAndUpdate(
      { _id: id, schlId, deleted: false },
      { deleted: true },
    );

    if (!cls) {
      return res.status(404).json({ message: "Class not found" });
    }

    return res.status(200).json({ message: "Class deleted successfully" });
  } catch (error) {
    console.error("Delete class error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};
