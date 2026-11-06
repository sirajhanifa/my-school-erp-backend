// Gives every school a default password for new users, read from DEFAULT_USER_PASSWORD in .env.
// Only schools without one get it, so an existing default password is never changed.
// Run with: npm run seed:default-password

// Must be the first import, so .env is loaded first
import "dotenv/config";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import DefaultPassword from "../models/defaultPassword.model.js";
import School from "../models/school.model.js";

const seedDefaultPassword = async () => {
  // Read from .env, so the password is never written in the code
  const password = process.env.DEFAULT_USER_PASSWORD?.trim() ?? "";
  if (password.length < 6) {
    throw new Error("DEFAULT_USER_PASSWORD in .env must be at least 6 characters");
  }

  await connectDB();

  const schools = await School.find().select("_id");
  let added = 0;
  for (const school of schools) {
    const exists = await DefaultPassword.exists({ schlId: school._id });
    if (exists) continue;

    await DefaultPassword.create({ schlId: school._id, password });
    added++;
  }
  console.log(`Added a default password for ${added} of ${schools.length} school(s)`);

  await mongoose.disconnect();
};

seedDefaultPassword().catch(async (error) => {
  console.error("Seeding default password failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
