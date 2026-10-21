// Must be the first import so .env values are loaded before any other file reads process.env
import "dotenv/config";
import mongoose from "mongoose";

import connectDB from "./config/db.js";
import Module from "./models/module.model.js";
import Role from "./models/role.model.js";
import School from "./models/school.model.js";

const roles = [
  { name: "admin", description: "Full access to manage the school, users and settings" },
  { name: "principal", description: "Oversees academics, staff and school reports" },
  { name: "teacher", description: "Manages classes, attendance, marks and homework" },
  { name: "accountant", description: "Manages fees, payments and financial reports" },
  { name: "librarian", description: "Manages library books, issues and returns" },
  { name: "student", description: "Views own timetable, attendance, marks and fees" },
  { name: "parent", description: "Views their child's attendance, marks and fee details" },
];

// Default menu every school starts with. Schools can change it later in the database.
// A main menu with a path links directly; a main menu with submenus only groups them.
const defaultModules = [
  { name: "Dashboard", code: "dashboard", icon: "LayoutDashboard", path: "/dashboard", subMenus: [] },
  {
    name: "Students",
    code: "students",
    icon: "Users",
    subMenus: [
      { name: "Admission", code: "student-admission", icon: "UserPlus", path: "/students/admission" },
      { name: "Student List", code: "student-list", icon: "List", path: "/students" },
      { name: "Promotion", code: "student-promotion", icon: "ArrowUpCircle", path: "/students/promotion" },
    ],
  },
  {
    name: "Staff",
    code: "staff",
    icon: "Briefcase",
    subMenus: [
      { name: "Add Staff", code: "staff-add", icon: "UserPlus", path: "/staff/add" },
      { name: "Staff List", code: "staff-list", icon: "List", path: "/staff" },
    ],
  },
  {
    name: "Academics",
    code: "academics",
    icon: "GraduationCap",
    subMenus: [
      { name: "Classes", code: "classes", icon: "School", path: "/academics/classes" },
      { name: "Sections", code: "sections", icon: "LayoutGrid", path: "/academics/sections" },
      { name: "Subjects", code: "subjects", icon: "BookOpen", path: "/academics/subjects" },
      { name: "Timetable", code: "timetable", icon: "Clock", path: "/academics/timetable" },
    ],
  },
  {
    name: "Attendance",
    code: "attendance",
    icon: "CalendarCheck",
    subMenus: [
      { name: "Student Attendance", code: "student-attendance", icon: "UserCheck", path: "/attendance/students" },
      { name: "Staff Attendance", code: "staff-attendance", icon: "UserCheck", path: "/attendance/staff" },
    ],
  },
  {
    name: "Exams",
    code: "exams",
    icon: "ClipboardList",
    subMenus: [
      { name: "Exam Schedule", code: "exam-schedule", icon: "Calendar", path: "/exams/schedule" },
      { name: "Marks Entry", code: "marks-entry", icon: "PenLine", path: "/exams/marks" },
      { name: "Report Cards", code: "report-cards", icon: "FileText", path: "/exams/report-cards" },
    ],
  },
  {
    name: "Fees",
    code: "fees",
    icon: "Wallet",
    subMenus: [
      { name: "Fee Structure", code: "fee-structure", icon: "Layers", path: "/fees/structure" },
      { name: "Collect Fees", code: "fee-collect", icon: "IndianRupee", path: "/fees/collect" },
      { name: "Fee Reports", code: "fee-reports", icon: "BarChart3", path: "/fees/reports" },
    ],
  },
  {
    name: "Library",
    code: "library",
    icon: "Library",
    subMenus: [
      { name: "Books", code: "library-books", icon: "Book", path: "/library/books" },
      { name: "Issue / Return", code: "library-issue", icon: "ArrowLeftRight", path: "/library/issue" },
    ],
  },
  {
    name: "Settings",
    code: "settings",
    icon: "Settings",
    subMenus: [
      { name: "School Profile", code: "school-profile", icon: "Building2", path: "/settings/school" },
      { name: "Users", code: "settings-users", icon: "UserCog", path: "/settings/users" },
      { name: "Roles", code: "settings-roles", icon: "ShieldCheck", path: "/settings/roles" },
    ],
  },
];

// Gives one school the default menu.
// Only MISSING menus are added, so running the seed again never overwrites
// a school's own changes (renamed, reordered or switched-off menus).
const seedModulesForSchool = async (schlId: mongoose.Types.ObjectId) => {
  const menuDoc = await Module.findOne({ schlId });

  // First time: create the school's menu document with all defaults
  if (!menuDoc) {
    await Module.create({ schlId, modules: defaultModules });
    return;
  }

  // Already has a menu: add any default main menu or submenu that is missing
  for (const defaultMainMenu of defaultModules) {
    const mainMenu = menuDoc.modules.find((menu) => menu.code === defaultMainMenu.code);

    if (!mainMenu) {
      menuDoc.modules.push(defaultMainMenu);
      continue;
    }

    for (const defaultSubMenu of defaultMainMenu.subMenus) {
      const exists = mainMenu.subMenus.some((subMenu) => subMenu.code === defaultSubMenu.code);
      if (!exists) mainMenu.subMenus.push(defaultSubMenu);
    }
  }

  await menuDoc.save();
};

const seed = async () => {
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

  // Every school gets its own copy of the default menu
  const schools = await School.find().select("_id");
  for (const school of schools) {
    await seedModulesForSchool(school._id);
  }
  console.log(`Seeded modules for ${schools.length} school(s)`);

  await mongoose.disconnect();
};

seed().catch(async (error) => {
  console.error("Seeding failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
