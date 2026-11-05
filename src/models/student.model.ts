import mongoose from "mongoose";

// Registers the Class and Section models, so populate("classId") / populate("sectionId") work
import "./class.model.js";
import "./section.model.js";

// The allowed gender values (also used by the controller to validate input)
export const GENDERS = ["Male", "Female", "Other"] as const;

// A student of a school.
const studentSchema = new mongoose.Schema(
  {
    // The school (tenant) this student belongs to
    schlId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    admissionNo: { type: String, required: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: "" },
    gender: { type: String, required: true, enum: GENDERS },
    dateOfBirth: { type: Date, required: true },
    // The student's class (a document in the classes collection)
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    // The student's section (a document in the sections collection)
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      required: true,
    },
    guardianName: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    // Soft delete: a deleted student stays in the database but should be hidden from queries
    deleted: { type: Boolean, default: false },
  },
  // Adds createdAt and updatedAt automatically
  { timestamps: true },
);

// An admission number must be unique within a school, but only among students that are not deleted.
studentSchema.index(
  { schlId: 1, admissionNo: 1 },
  { unique: true, partialFilterExpression: { deleted: false } },
);

// Third argument = collection name in MongoDB
const Student = mongoose.model("Student", studentSchema, "students");

export default Student;
