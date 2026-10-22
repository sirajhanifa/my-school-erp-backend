import mongoose from "mongoose";

// A class of a school, e.g. "Class 1" or "LKG".
const classSchema = new mongoose.Schema(
  {
    // The school (tenant) this class belongs to
    schlId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    // Soft delete: a deleted class stays in the database but should be hidden from queries
    deleted: { type: Boolean, default: false },
  },
  // Adds createdAt and updatedAt automatically
  { timestamps: true },
);

// A class name must be unique within a school, but only among classes that are not deleted,
// so two schools can both have "Class 1" and a deleted class's name can be reused.
classSchema.index(
  { schlId: 1, name: 1 },
  { unique: true, partialFilterExpression: { deleted: false } },
);

// Third argument = collection name in MongoDB
const Class = mongoose.model("Class", classSchema, "classes");

export default Class;
