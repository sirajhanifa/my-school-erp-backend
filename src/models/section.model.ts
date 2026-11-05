import mongoose from "mongoose";

// A section of a school, e.g. "A" or "Blue". Sections are independent of classes.
const sectionSchema = new mongoose.Schema(
  {
    // The school (tenant) this section belongs to
    schlId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    // Soft delete: a deleted section stays in the database but should be hidden from queries
    deleted: { type: Boolean, default: false },
  },
  // Adds createdAt and updatedAt automatically
  { timestamps: true },
);

// A section name must be unique within a school, but only among sections that are not deleted,
// so two schools can both have "A" and a deleted section's name can be reused.
sectionSchema.index(
  { schlId: 1, name: 1 },
  { unique: true, partialFilterExpression: { deleted: false } },
);

// Third argument = collection name in MongoDB
const Section = mongoose.model("Section", sectionSchema, "sections");

export default Section;
