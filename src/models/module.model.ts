import mongoose from "mongoose";

// The menu of a school is stored as ONE document per school:
//
// {
//   schlId: <school id>,
//   modules: [                      <- main menus (array order = display order)
//     {
//       name, code, icon, path, isActive, deleted,
//       subMenus: [                 <- submenus of this main menu (array order = display order)
//         { name, code, icon, path, isActive, deleted }
//       ]
//     }
//   ]
// }
//
// Each school has its own document, so one school can rename, reorder or
// switch off a menu without affecting any other school.

// A submenu, e.g. "Admission" under "Students". It always opens a page, so path is required.
const subMenuSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // Stable identifier used by code, e.g. "student-admission". Unlike the name, it should not change.
  code: { type: String, required: true, lowercase: true, trim: true },
  // Name of a lucide-react icon, e.g. "UserPlus"
  icon: { type: String, trim: true, default: "Circle" },
  // Frontend route, e.g. "/students/admission"
  path: { type: String, required: true, trim: true },
  // An inactive menu is switched off for this school but can be turned back on
  isActive: { type: Boolean, default: true },
  // Soft delete: a deleted menu stays in the database but is hidden
  deleted: { type: Boolean, default: false },
});

// A main menu, e.g. "Students".
// It either links to a page directly (has a path, no submenus, like "Dashboard")
// or only groups its submenus (empty path).
const mainMenuSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, lowercase: true, trim: true },
  icon: { type: String, trim: true, default: "Box" },
  path: { type: String, trim: true, default: "" },
  isActive: { type: Boolean, default: true },
  deleted: { type: Boolean, default: false },
  subMenus: { type: [subMenuSchema], default: [] },
});

const moduleSchema = new mongoose.Schema(
  {
    // The school (tenant) this menu belongs to. unique: each school has only one menu document.
    schlId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      unique: true,
    },
    modules: { type: [mainMenuSchema], default: [] },
  },
  // Adds createdAt and updatedAt automatically
  { timestamps: true },
);

// Every menu code (main menus and submenus together) must be unique within a school,
// so any menu item can be found by its code alone.
// MongoDB indexes cannot check this inside an array, so we check it before saving.
moduleSchema.pre("validate", function () {
  const seenCodes = new Set<string>();

  for (const mainMenu of this.modules) {
    if (mainMenu.deleted) continue;

    // Collect the codes of this main menu and its (not deleted) submenus
    const codes = [mainMenu.code];
    for (const subMenu of mainMenu.subMenus) {
      if (!subMenu.deleted) codes.push(subMenu.code);
    }

    for (const code of codes) {
      if (seenCodes.has(code)) {
        throw new Error(`Menu code "${code}" is used more than once`);
      }
      seenCodes.add(code);
    }
  }
});

// Third argument = collection name in MongoDB
const Module = mongoose.model("Module", moduleSchema, "modules");

export default Module;
