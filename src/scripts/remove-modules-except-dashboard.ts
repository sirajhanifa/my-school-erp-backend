// ONE-TIME cleanup: permanently removes every main menu (and its submenus)
// except Dashboard from every school's menu document.
// This cannot be undone. Run with: npx tsx src/scripts/remove-modules-except-dashboard.ts

// Must be the first import so .env values are loaded before any other file reads process.env
import "dotenv/config";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import Module from "../models/module.model.js";

const removeModules = async () => {
  await connectDB();

  // $pull removes from the modules array every main menu whose code is not "dashboard".
  // Submenus live inside their main menu, so they are removed with it.
  const result = await Module.updateMany(
    {},
    { $pull: { modules: { code: { $ne: "dashboard" } } } },
  );
  console.log(`Removed modules from ${result.modifiedCount} school menu(s)`);

  await mongoose.disconnect();
};

removeModules().catch(async (error) => {
  console.error("Removing modules failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
