import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    // Soft delete: a deleted role stays in the database but should be hidden from queries
    deleted: { type: Boolean, default: false },
  },
  // Adds createdAt and updatedAt automatically
  { timestamps: true },
);

// Role names must be unique, but only among roles that are not deleted,
// so a deleted role's name can be reused.
roleSchema.index({ name: 1 }, { unique: true, partialFilterExpression: { deleted: false } });

// Third argument = collection name in MongoDB
const Role = mongoose.model("Role", roleSchema, "roles");

export default Role;
