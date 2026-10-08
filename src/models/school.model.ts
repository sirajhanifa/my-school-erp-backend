import mongoose from "mongoose";

// A School is a tenant: every user, class, student, fee, etc. will belong to exactly one school,
// and data from one school must never be visible to another.
const schoolSchema = new mongoose.Schema(
  {
    schlNm: { type: String, required: true, trim: true },
    // Short unique identifier for the tenant, e.g. "greenwood-high".
    // Can be used later in URLs or subdomains (greenwood-high.myschoolerp.com) and on the login screen.
    schlCd: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, "Code can only contain lowercase letters, numbers and hyphens"],
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      country: { type: String, trim: true, default: "India" },
    },
    logoUrl: { type: String, trim: true },
    // Used when showing dates and times (attendance, fee due dates) for this school
    timezone: { type: String, default: "Asia/Kolkata" },
    // An inactive school (e.g. subscription ended) should not be able to log in
    isActive: { type: Boolean, default: true },
  },
  // Adds createdAt and updatedAt automatically
  { timestamps: true },
);

// Third argument = collection name in MongoDB
const School = mongoose.model("School", schoolSchema, "schools");

export default School;
