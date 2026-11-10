// Gives the superadmin role (full access) to one user.
// Run with: npm run make-superadmin -- someone@school.com

// Must be the first import so .env values are loaded before any other file reads process.env
import "dotenv/config";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import { FULL_ACCESS_ROLE } from "../middleware/moduleAccess.middleware.js";
import Role from "../models/role.model.js";
import User from "../models/user.model.js";

const makeSuperadmin = async () => {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    throw new Error("Please give an email: npm run make-superadmin -- someone@school.com");
  }

  await connectDB();

  // The role comes from the roles seed (npm run seed:roles)
  const role = await Role.findOne({ name: FULL_ACCESS_ROLE, deleted: false });
  if (!role) {
    throw new Error(`The "${FULL_ACCESS_ROLE}" role does not exist. Run npm run seed:roles first.`);
  }

  const user = await User.findOneAndUpdate(
    { email, deleted: { $ne: true } },
    { role: role._id },
  );
  if (!user) {
    throw new Error(`No user found with email ${email}`);
  }

  console.log(`${email} is now a ${FULL_ACCESS_ROLE}`);
  await mongoose.disconnect();
};

makeSuperadmin().catch(async (error) => {
  console.error("Make superadmin failed:", error instanceof Error ? error.message : error);
  await mongoose.disconnect();
  process.exit(1);
});
