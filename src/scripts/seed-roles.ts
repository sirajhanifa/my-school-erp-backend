// Seeds the default roles.
// Run on its own with: npm run seed:roles

// Must be the first import so .env values are loaded before any other file reads process.env
import "dotenv/config";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import Role from "../models/role.model.js";

const roles = [
  { name: "admin", description: "Full access to manage the school, users and settings" },
  { name: "principal", description: "Oversees academics, staff and school reports" },
  { name: "teacher", description: "Manages classes, attendance, marks and homework" },
  { name: "accountant", description: "Manages fees, payments and financial reports" },
  { name: "librarian", description: "Manages library books, issues and returns" },
  { name: "student", description: "Views own timetable, attendance, marks and fees" },
  { name: "parent", description: "Views their child's attendance, marks and fee details" },
];

const seedRoles = async () => {
  await connectDB();

  // Upsert by name, so running the seed again updates existing roles instead of creating duplicates
  for (const role of roles) {
    await Role.updateOne(
      { name: role.name, deleted: false },
      { $set: { description: role.description } },
      { upsert: true },
    );
  }
  console.log(`Seeded ${roles.length} roles`);

  await mongoose.disconnect();
};

seedRoles().catch(async (error) => {
  console.error("Seeding roles failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
