import mongoose from "mongoose";

// The password every new user of a school starts with.
// Stored as plain text because the User model's pre("save") hook hashes it when a user is created.
const defaultPasswordSchema = new mongoose.Schema(
  {
    // One default password per school
    schlId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      unique: true,
    },
    // select: false -> never returned by queries unless we ask for it with .select("+password")
    password: { type: String, required: true, minlength: 6, select: false },
  },
  // Adds createdAt and updatedAt automatically
  { timestamps: true },
);

// Third argument = collection name in MongoDB
const DefaultPassword = mongoose.model("DefaultPassword", defaultPasswordSchema, "defaultpasswords");

export default DefaultPassword;
