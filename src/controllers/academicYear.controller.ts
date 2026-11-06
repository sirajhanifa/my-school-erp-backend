import type { Request, Response } from "express";
import mongoose from "mongoose";

import AcademicYear from "../models/academicYear.model.js";
import User from "../models/user.model.js";

// Returns the logged-in user's school id (null if the user is missing or inactive).
// Never taken from the request, so users can only touch their own school's academic years.
const getSchoolId = async (res: Response) => {
  const user = await User.findById(res.locals.userId).select("schlId isActive");
  if (!user || !user.isActive) return null;
  return user.schlId;
};

// MongoDB error code for "duplicate key" (here: same academic year name twice in one school)
const DUPLICATE_KEY_ERROR = 11000;

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === DUPLICATE_KEY_ERROR;

// The shape of an academic year sent to the frontend
const toAcademicYearResponse = (academicYear: InstanceType<typeof AcademicYear>) => ({
  id: academicYear.id,
  name: academicYear.name,
  description: academicYear.description,
  // Status: deleted = Inactive, not deleted = Active
  deleted: academicYear.deleted,
  createdAt: academicYear.createdAt,
  updatedAt: academicYear.updatedAt,
});

// GET /api/academic-years  (protected: lists all academic years of the logged-in user's school, active and inactive)
export const getAcademicYears = async (_req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const academicYears = await AcademicYear.find({ schlId }).sort({ name: 1 });

    return res
      .status(200)
      .json({ academicYears: academicYears.map(toAcademicYearResponse) });
  } catch (error) {
    console.error("Get academic years error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// POST /api/academic-years
export const createAcademicYear = async (req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const { name, description, deleted } = req.body ?? {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Academic year name is required" });
    }

    const academicYear = await AcademicYear.create({
      schlId,
      name: String(name),
      description: description ? String(description) : "",
      // Active unless the client sends deleted: true (Active checkbox unchecked)
      deleted: deleted === true,
    });

    return res.status(201).json({
      message: "Academic year created successfully",
      academicYear: toAcademicYearResponse(academicYear),
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res
        .status(409)
        .json({ message: "An academic year with this name already exists" });
    }
    console.error("Create academic year error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// PUT /api/academic-years/:id
export const updateAcademicYear = async (req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const { id } = req.params;
    const { name, description, deleted } = req.body ?? {};

    // An invalid id cannot match any academic year, so treat it as "not found"
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Academic year not found" });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Academic year name is required" });
    }

    // Filtering by schlId too makes sure a user can only update their own school's academic year.
    // Inactive (deleted) academic years can be edited too, e.g. to make them Active again.
    const academicYear = await AcademicYear.findOneAndUpdate(
      { _id: id, schlId },
      {
        name: String(name),
        description: description ? String(description) : "",
        // Only change the status when the client sends it
        ...(typeof deleted === "boolean" && { deleted }),
      },
      // new: return the updated document; runValidators: apply the schema rules on update too
      { new: true, runValidators: true },
    );

    if (!academicYear) {
      return res.status(404).json({ message: "Academic year not found" });
    }

    return res.status(200).json({
      message: "Academic year updated successfully",
      academicYear: toAcademicYearResponse(academicYear),
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res
        .status(409)
        .json({ message: "An academic year with this name already exists" });
    }
    console.error("Update academic year error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// DELETE /api/academic-years/:id  (soft delete: the academic year is only marked as deleted)
export const deleteAcademicYear = async (req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Academic year not found" });
    }

    const academicYear = await AcademicYear.findOneAndUpdate(
      { _id: id, schlId, deleted: false },
      { deleted: true },
    );

    if (!academicYear) {
      return res.status(404).json({ message: "Academic year not found" });
    }

    return res.status(200).json({ message: "Academic year deleted successfully" });
  } catch (error) {
    console.error("Delete academic year error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};
