import mongoose from "mongoose";

// An academic year of a school, e.g. "2025-26".
const academicYearSchema = new mongoose.Schema(
  {
    // The school (tenant) this academic year belongs to
    schlId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    // Soft delete: a deleted academic year stays in the database but should be hidden from queries
    deleted: { type: Boolean, default: false },
  },
  // Adds createdAt and updatedAt automatically
  { timestamps: true },
);

// An academic year name must be unique within a school, but only among academic years that are
// not deleted, so two schools can both have "2025-26" and a deleted name can be reused.
academicYearSchema.index(
  { schlId: 1, name: 1 },
  { unique: true, partialFilterExpression: { deleted: false } },
);

// Third argument = collection name in MongoDB
const AcademicYear = mongoose.model("AcademicYear", academicYearSchema, "academicYears");

export default AcademicYear;
