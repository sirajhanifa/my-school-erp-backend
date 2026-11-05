import type { Request, Response } from "express";
import mongoose from "mongoose";

import Section from "../models/section.model.js";
import User from "../models/user.model.js";

// Returns the logged-in user's school id (null if the user is missing or inactive).
// Never taken from the request, so users can only touch their own school's sections.
const getSchoolId = async (res: Response) => {
  const user = await User.findById(res.locals.userId).select("schlId isActive");
  if (!user || !user.isActive) return null;
  return user.schlId;
};

// MongoDB error code for "duplicate key" (here: same section name twice in one school)
const DUPLICATE_KEY_ERROR = 11000;

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === DUPLICATE_KEY_ERROR;

// The shape of a section sent to the frontend
const toSectionResponse = (section: InstanceType<typeof Section>) => ({
  id: section.id,
  name: section.name,
  description: section.description,
  createdAt: section.createdAt,
  updatedAt: section.updatedAt,
});

// GET /api/sections  (protected: lists the sections of the logged-in user's school)
export const getSections = async (_req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const sections = await Section.find({ schlId, deleted: false }).sort({ name: 1 });

    return res.status(200).json({ sections: sections.map(toSectionResponse) });
  } catch (error) {
    console.error("Get sections error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// POST /api/sections
export const createSection = async (req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const { name, description } = req.body ?? {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Section name is required" });
    }

    const section = await Section.create({
      schlId,
      name: String(name),
      description: description ? String(description) : "",
    });

    return res.status(201).json({
      message: "Section created successfully",
      section: toSectionResponse(section),
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res
        .status(409)
        .json({ message: "A section with this name already exists" });
    }
    console.error("Create section error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// PUT /api/sections/:id
export const updateSection = async (req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const { id } = req.params;
    const { name, description } = req.body ?? {};

    // An invalid id cannot match any section, so treat it as "not found"
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Section not found" });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Section name is required" });
    }

    // Filtering by schlId too makes sure a user can only update their own school's section
    const section = await Section.findOneAndUpdate(
      { _id: id, schlId, deleted: false },
      {
        name: String(name),
        description: description ? String(description) : "",
      },
      // new: return the updated document; runValidators: apply the schema rules on update too
      { new: true, runValidators: true },
    );

    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    return res.status(200).json({
      message: "Section updated successfully",
      section: toSectionResponse(section),
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res
        .status(409)
        .json({ message: "A section with this name already exists" });
    }
    console.error("Update section error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// DELETE /api/sections/:id  (soft delete: the section is only marked as deleted)
export const deleteSection = async (req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Section not found" });
    }

    const section = await Section.findOneAndUpdate(
      { _id: id, schlId, deleted: false },
      { deleted: true },
    );

    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    return res.status(200).json({ message: "Section deleted successfully" });
  } catch (error) {
    console.error("Delete section error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};
