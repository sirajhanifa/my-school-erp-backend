import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
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
    role: {
      type: String,
      enum: ["admin", "teacher", "student", "parent"],
      default: "admin",
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
