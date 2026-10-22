// Adds the default menu to every school.
// To add a module: add it to defaultModules below, then run: npm run seed:modules

// Must be the first import, so .env is loaded first
import "dotenv/config";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import Module from "../models/module.model.js";
import School from "../models/school.model.js";

// Shape of a menu item
type SubMenu = { name: string; code: string; icon: string; path: string; order: number };
type MainMenu = { name: string; code: string; icon: string; path?: string; order: number; subMenus: SubMenu[] };

// The default menu. order = display position (1 shows first).
//
// Example with submenus:
// {
//   name: "Students", code: "students", icon: "Users", order: 2,
//   subMenus: [
//     { name: "Admission", code: "student-admission", icon: "UserPlus", path: "/students/admission", order: 1 },
//   ],
// },
const defaultModules: MainMenu[] = [
  { name: "Dashboard", code: "dashboard", icon: "LayoutDashboard", path: "/dashboard", order: 1, subMenus: [] },
  {
    name: "Organization Setup", code: "organization-setup", icon: "Building2", path: "", order: 2,
    subMenus: [
      { name: "Classes", code: "classes", icon: "School", path: "/organization-setup/classes", order: 1 },
    ],
  },
];

// Adds the default menu to one school.
// Only missing menus are added, so existing menus are never changed.
const seedModulesForSchool = async (schlId: mongoose.Types.ObjectId) => {
  const menuDoc = await Module.findOne({ schlId });

  // School has no menu yet: create it
  if (!menuDoc) {
    await Module.create({ schlId, modules: defaultModules });
    return;
  }

  // School has a menu: add what is missing, and set order where it is not set (0)
  for (const defaultMainMenu of defaultModules) {
    const mainMenu = menuDoc.modules.find((menu) => menu.code === defaultMainMenu.code);

    if (!mainMenu) {
      menuDoc.modules.push(defaultMainMenu);
      continue;
    }

    if (mainMenu.order === 0) mainMenu.order = defaultMainMenu.order;

    for (const defaultSubMenu of defaultMainMenu.subMenus) {
      const subMenu = mainMenu.subMenus.find((menu) => menu.code === defaultSubMenu.code);

      if (!subMenu) {
        mainMenu.subMenus.push(defaultSubMenu);
        continue;
      }

      if (subMenu.order === 0) subMenu.order = defaultSubMenu.order;
    }
  }

  await menuDoc.save();
};

const seedModules = async () => {
  await connectDB();

  // Each school gets its own menu
  const schools = await School.find().select("_id");
  for (const school of schools) {
    await seedModulesForSchool(school._id);
  }
  console.log(`Seeded modules for ${schools.length} school(s)`);

  await mongoose.disconnect();
};

seedModules().catch(async (error) => {
  console.error("Seeding modules failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
