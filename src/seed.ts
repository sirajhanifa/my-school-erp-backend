// Adds dummy users for testing login. Run with: npm run seed
// Safe to run again: it removes these same users first, then creates them fresh.
import "dotenv/config";
import mongoose from "mongoose";

import User from "./models/user.model.js";

type DummyUser = {
  name: string;
  email: string;
  password: string;
  role: "admin" | "teacher" | "student" | "parent";
  isActive?: boolean;
};

const dummyUsers: DummyUser[] = [
  { name: "School Admin", email: "admin@school.com", password: "admin123", role: "admin" },
  { name: "Priya Teacher", email: "teacher@school.com", password: "teacher123", role: "teacher" },
  { name: "Arun Student", email: "student@school.com", password: "student123", role: "student" },
  { name: "Meena Parent", email: "parent@school.com", password: "parent123", role: "parent" },
  // To test the "account is inactive" error
  { name: "Old Staff", email: "inactive@school.com", password: "inactive123", role: "teacher", isActive: false },
];

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI as string);

  await User.deleteMany({ email: { $in: dummyUsers.map((user) => user.email) } });

  // User.create (not insertMany) so the pre("save") hook hashes each password
  await User.create(dummyUsers);

  console.log("Dummy users created:");
  console.table(dummyUsers.map(({ email, password, role, isActive }) => ({ email, password, role, active: isActive ?? true })));

  await mongoose.disconnect();
};

seed().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
