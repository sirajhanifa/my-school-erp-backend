import bcrypt from "bcryptjs";
import mongoose from "mongoose";

// Registers the Role model, so populate("role") works wherever User is used
import "./role.model.js";

const userSchema = new mongoose.Schema(
  {
    // The school (tenant) this user belongs to
    schlId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // select: false -> password is NOT returned by queries unless we ask for it with .select("+password")
    password: { type: String, required: true, minlength: 6, select: false },
    // The user's role (a document in the roles collection)
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  // Adds createdAt and updatedAt automatically
  { timestamps: true },
);

// Hash the password before saving, so a plain password is never stored in the database.
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Third argument = collection name in MongoDB
const User = mongoose.model("User", userSchema, "users");

export default User;
