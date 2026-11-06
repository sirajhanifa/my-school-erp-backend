import type { Request, Response } from "express";
import mongoose from "mongoose";

import Class from "../models/class.model.js";
import Section from "../models/section.model.js";
import Student, { GENDERS } from "../models/student.model.js";
import User from "../models/user.model.js";

// Returns the logged-in user's school id (null if the user is missing or inactive).
// Never taken from the request, so users can only touch their own school's students.
const getSchoolId = async (res: Response) => {
  const user = await User.findById(res.locals.userId).select("schlId isActive");
  if (!user || !user.isActive) return null;
  return user.schlId;
};

// MongoDB error code for "duplicate key" (here: same admission number twice in one school)
const DUPLICATE_KEY_ERROR = 11000;

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === DUPLICATE_KEY_ERROR;

// Replace classId / sectionId with { _id, name }, so the list can show the names
const populateNames = [
  { path: "classId", select: "name" },
  { path: "sectionId", select: "name" },
];

// What classId / sectionId look like after populate (null if the class/section no longer exists)
type NamedRef = { _id: mongoose.Types.ObjectId; name: string } | null;

// The shape of a student sent to the frontend. The student must be populated first.
const toStudentResponse = (student: InstanceType<typeof Student>) => {
  const cls = student.classId as unknown as NamedRef;
  const section = student.sectionId as unknown as NamedRef;

  return {
    id: student.id,
    admissionNo: student.admissionNo,
    firstName: student.firstName,
    lastName: student.lastName,
    gender: student.gender,
    // "YYYY-MM-DD", so the frontend shows the same date in every time zone
    dateOfBirth: student.dateOfBirth.toISOString().slice(0, 10),
    classId: cls?._id.toString() ?? "",
    className: cls?.name ?? "",
    sectionId: section?._id.toString() ?? "",
    sectionName: section?.name ?? "",
    guardianName: student.guardianName,
    phone: student.phone,
    address: student.address,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
  };
};

// True if the value is one of the allowed genders (tells TypeScript it is "Male" | "Female" | "Other")
const isGender = (value: string): value is (typeof GENDERS)[number] =>
  GENDERS.includes(value as (typeof GENDERS)[number]);

// Checks the request body for create and update.
// Returns { error } with a message for the user, or { data } with the cleaned values to save.
const validateStudentBody = async (
  body: Record<string, unknown>,
  schlId: mongoose.Types.ObjectId,
) => {
  const text = (value: unknown) => (value ? String(value).trim() : "");

  const admissionNo = text(body.admissionNo);
  const firstName = text(body.firstName);
  const gender = text(body.gender);
  const dateOfBirth = new Date(text(body.dateOfBirth));
  const classId = text(body.classId);
  const sectionId = text(body.sectionId);

  if (!admissionNo) return { error: "Admission number is required" };
  if (!firstName) return { error: "First name is required" };
  if (!isGender(gender)) return { error: "Please select a gender" };
  if (Number.isNaN(dateOfBirth.getTime())) {
    return { error: "Please enter a valid date of birth" };
  }

  // The class and section must exist in this school and not be deleted
  const classExists =
    mongoose.isValidObjectId(classId) &&
    (await Class.exists({ _id: classId, schlId, deleted: false }));
  if (!classExists) return { error: "Please select a valid class" };

  const sectionExists =
    mongoose.isValidObjectId(sectionId) &&
    (await Section.exists({ _id: sectionId, schlId, deleted: false }));
  if (!sectionExists) return { error: "Please select a valid section" };

  return {
    data: {
      admissionNo,
      firstName,
      lastName: text(body.lastName),
      gender,
      dateOfBirth,
      classId,
      sectionId,
      guardianName: text(body.guardianName),
      phone: text(body.phone),
      address: text(body.address),
    },
  };
};

// GET /api/students  (protected: lists the students of the logged-in user's school)
// Optional filters: ?classId=...&sectionId=...  (missing = all)
export const getStudents = async (req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    // schlId always comes from the logged-in user, so filters can never reach another school
    const query: Record<string, unknown> = { schlId, deleted: false };

    const { classId, sectionId } = req.query;
    if (classId !== undefined) {
      // A bad id cannot match any student, so the answer is simply an empty list
      if (!mongoose.isValidObjectId(classId)) {
        return res.status(200).json({ students: [] });
      }
      query.classId = classId;
    }
    if (sectionId !== undefined) {
      if (!mongoose.isValidObjectId(sectionId)) {
        return res.status(200).json({ students: [] });
      }
      query.sectionId = sectionId;
    }

    // numericOrdering: "2" comes before "10"
    const students = await Student.find(query)
      .collation({ locale: "en", numericOrdering: true })
      .sort({ admissionNo: 1 })
      .populate(populateNames);

    return res.status(200).json({ students: students.map(toStudentResponse) });
  } catch (error) {
    console.error("Get students error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// POST /api/students
export const createStudent = async (req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const { error, data } = await validateStudentBody(req.body ?? {}, schlId);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const student = await Student.create({ schlId, ...data });
    await student.populate(populateNames);

    return res.status(201).json({
      message: "Student created successfully",
      student: toStudentResponse(student),
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res
        .status(409)
        .json({ message: "A student with this admission number already exists" });
    }
    console.error("Create student error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// PUT /api/students/:id
export const updateStudent = async (req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const { id } = req.params;

    // An invalid id cannot match any student, so treat it as "not found"
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Student not found" });
    }

    const { error, data } = await validateStudentBody(req.body ?? {}, schlId);
    if (error) {
      return res.status(400).json({ message: error });
    }

    // Filtering by schlId too makes sure a user can only update their own school's student
    const student = await Student.findOneAndUpdate(
      { _id: id, schlId, deleted: false },
      data,
      // new: return the updated document; runValidators: apply the schema rules on update too
      { new: true, runValidators: true },
    ).populate(populateNames);

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    return res.status(200).json({
      message: "Student updated successfully",
      student: toStudentResponse(student),
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res
        .status(409)
        .json({ message: "A student with this admission number already exists" });
    }
    console.error("Update student error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// DELETE /api/students/:id  (soft delete: the student is only marked as deleted)
export const deleteStudent = async (req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Student not found" });
    }

    const student = await Student.findOneAndUpdate(
      { _id: id, schlId, deleted: false },
      { deleted: true },
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    return res.status(200).json({ message: "Student deleted successfully" });
  } catch (error) {
    console.error("Delete student error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};
