import type { Request, Response } from "express";
import mongoose from "mongoose";

import Class from "../models/class.model.js";
import Section from "../models/section.model.js";
import Student, { GENDERS } from "../models/student.model.js";
import User from "../models/user.model.js";
import { buildStudentTemplate, readStudentRows } from "../utils/studentExcel.js";

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

// Checks the student fields that need no database (shared by create, update and Excel import).
// Returns { error } with a message for the user, or { data } with the cleaned values.
const checkStudentFields = (body: Record<string, unknown>) => {
  const text = (value: unknown) => (value ? String(value).trim() : "");

  const admissionNo = text(body.admissionNo);
  const firstName = text(body.firstName);
  const gender = text(body.gender);
  const dateOfBirth = new Date(text(body.dateOfBirth));

  if (!admissionNo) return { error: "Admission number is required" };
  if (!firstName) return { error: "First name is required" };
  if (!isGender(gender)) return { error: "Please select a gender" };
  if (Number.isNaN(dateOfBirth.getTime())) {
    return { error: "Please enter a valid date of birth" };
  }

  return {
    data: {
      admissionNo,
      firstName,
      lastName: text(body.lastName),
      gender,
      dateOfBirth,
      classId: text(body.classId),
      sectionId: text(body.sectionId),
      guardianName: text(body.guardianName),
      phone: text(body.phone),
      address: text(body.address),
    },
  };
};

// Checks the request body for create and update.
// Returns { error } with a message for the user, or { data } with the cleaned values to save.
const validateStudentBody = async (
  body: Record<string, unknown>,
  schlId: mongoose.Types.ObjectId,
) => {
  const { error, data } = checkStudentFields(body);
  if (!data) return { error };

  // The class and section must exist in this school and not be deleted
  const classExists =
    mongoose.isValidObjectId(data.classId) &&
    (await Class.exists({ _id: data.classId, schlId, deleted: false }));
  if (!classExists) return { error: "Please select a valid class" };

  const sectionExists =
    mongoose.isValidObjectId(data.sectionId) &&
    (await Section.exists({ _id: data.sectionId, schlId, deleted: false }));
  if (!sectionExists) return { error: "Please select a valid section" };

  return { data };
};

// Most rows one Excel import may contain
const MAX_IMPORT_ROWS = 1000;

// Lower-case name -> id, so "class 5" in Excel matches the class "Class 5"
const toNameMap = (items: { _id: mongoose.Types.ObjectId; name: string }[]) =>
  new Map(items.map((item) => [item.name.trim().toLowerCase(), item._id.toString()]));

// The school's classes and sections that are not deleted, sorted by name
const loadClassesAndSections = (schlId: mongoose.Types.ObjectId) =>
  Promise.all([
    Class.find({ schlId, deleted: false }).select("name").sort({ name: 1 }).lean(),
    Section.find({ schlId, deleted: false }).select("name").sort({ name: 1 }).lean(),
  ]);

// GET /api/students/import/template  (downloads the Excel template for this school)
export const downloadStudentTemplate = async (_req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    const [classes, sections] = await loadClassesAndSections(schlId);
    const file = await buildStudentTemplate(
      classes.map((c) => c.name),
      sections.map((s) => s.name),
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", 'attachment; filename="student-import-template.xlsx"');
    return res.status(200).send(Buffer.from(file));
  } catch (error) {
    console.error("Download student template error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
};

// POST /api/students/import  (form field "file": an .xlsx file, read by uploadExcel)
// All or nothing: if any row has a problem, no student is saved and every problem is returned.
export const importStudents = async (req: Request, res: Response) => {
  try {
    const schlId = await getSchoolId(res);
    if (!schlId) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    // uploadExcel has already checked that a file is there
    const { error: fileError, rows } = await readStudentRows(req.file!.buffer);
    if (!rows) return res.status(400).json({ message: fileError });

    if (rows.length === 0) {
      return res.status(400).json({ message: "The file has no student rows" });
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      return res
        .status(400)
        .json({ message: `Please upload at most ${MAX_IMPORT_ROWS} students at a time` });
    }

    // Load classes and sections once, instead of one query per row
    const [classes, sections] = await loadClassesAndSections(schlId);
    const classIdOf = toNameMap(classes);
    const sectionIdOf = toNameMap(sections);

    // Admission numbers already used by this school's students (not deleted)
    const usedAdmissionNos = new Set(
      (await Student.find({ schlId, deleted: false }).select("admissionNo").lean()).map(
        (s) => s.admissionNo,
      ),
    );

    const errors: { row: number; message: string }[] = [];
    const students = [];
    // Row number where each admission number first appeared in this file
    const seenInFile = new Map<string, number>();

    for (const row of rows) {
      const addError = (message: string) => errors.push({ row: row.rowNo, message });

      // Excel dates arrive as "YYYY-MM-DD"; other text would be read in an unclear format
      if (row.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(row.dateOfBirth)) {
        addError("Date of birth must be a date or YYYY-MM-DD");
        continue;
      }

      const { error, data } = checkStudentFields({
        ...row,
        classId: classIdOf.get(row.className.toLowerCase()) ?? "",
        sectionId: sectionIdOf.get(row.sectionName.toLowerCase()) ?? "",
      });
      if (!data) {
        addError(error ?? "Invalid row");
        continue;
      }

      if (!data.classId) {
        addError(`Class "${row.className}" not found`);
        continue;
      }
      if (!data.sectionId) {
        addError(`Section "${row.sectionName}" not found`);
        continue;
      }
      if (usedAdmissionNos.has(data.admissionNo)) {
        addError(`Admission number ${data.admissionNo} already exists`);
        continue;
      }
      const firstRow = seenInFile.get(data.admissionNo);
      if (firstRow !== undefined) {
        addError(`Admission number ${data.admissionNo} is repeated (also in row ${firstRow})`);
        continue;
      }
      seenInFile.set(data.admissionNo, row.rowNo);

      students.push({ schlId, ...data });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        message: `${errors.length} row(s) have problems. No students were imported.`,
        errors,
      });
    }

    await Student.insertMany(students);

    return res.status(201).json({
      message: `${students.length} student(s) imported successfully`,
      count: students.length,
    });
  } catch (error) {
    // Another user added the same admission number while we were importing
    if (isDuplicateKeyError(error)) {
      return res
        .status(409)
        .json({ message: "Some admission numbers already exist. Please try again." });
    }
    console.error("Import students error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
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
