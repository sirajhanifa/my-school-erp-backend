# MySchool ERP — Backend

Multi-tenant school ERP API. Express 5 + Mongoose 9 + TypeScript, ESM (`"type": "module"`). The frontend lives in `../my-school-erp-frontend`.

## Commands

- `npm run dev` — nodemon runs `tsx src/index.ts`, restarts on changes in `src/`
- `npm run build` — `tsc` to `dist/`; `npm start` runs `dist/index.js`
- `npm run seed` — runs both seed scripts below (safe to re-run)
- `npm run seed:roles` — `src/scripts/seed-roles.ts`, upserts the default roles
- `npm run seed:modules` — `src/scripts/seed-modules.ts`, gives every school the default menu (only adds missing items). To add a module, edit `defaultModules` there and run this script.
- `npx tsc --noEmit` — type-check. There are no tests and no linter.

## Environment (`.env`)

`PORT` (9000 — the frontend's Vite proxy points here), `NODE_ENV`, `MONGO_URI`, `JWT_SECRET`.
`import "dotenv/config"` must stay the first import in any entry file (`index.ts`, `scripts/*.ts`).

## Layout

```
src/
  index.ts          app setup, mounts routes at /api
  config/db.ts      connectDB() — exits the process on failure
  routes/index.ts   main router; register each new route file here
  routes/*.routes.ts
  controllers/*.controller.ts
  middleware/auth.middleware.ts   protect: verifies JWT cookie, sets res.locals.userId
  models/*.model.ts
  scripts/          standalone scripts (seed-roles.ts, seed-modules.ts), each run on its own
```

## Conventions

- **ESM imports use `.js` extensions** for local files, even though the source is `.ts` (`import User from "../models/user.model.js"`). `module: nodenext` requires it.
- `verbatimModuleSyntax` is on: type-only imports must use `import type`.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on — don't assign `undefined` to optional props, and handle possibly-undefined array/index access.
- File naming: `<name>.model.ts`, `<name>.controller.ts`, `<name>.routes.ts`, `<name>.middleware.ts`. Default-export models and routers; named-export controller functions.
- Models: `mongoose.model("Name", schema, "collection")` — always pass the collection name explicitly. Use `{ timestamps: true }` for `createdAt`/`updatedAt`.
- Comments are plain-English and explain *why* (the codebase is written to be readable by learners). Keep that style.
- Keep comments simple and clear: one or two lines maximum. Avoid long explanations in comments.
- Controllers: `try/catch`, return `res.status(...).json({ message })`, log with `console.error("<Action> error:", error)`, and send a generic 500 message to the client.

## Data model

- **School** (`schools`) is the tenant. Fields use abbreviated names: `schlNm`, `schlCd` (unique slug), and other models reference it via `schlId`. Data must never leak across schools — scope tenant data queries by `schlId`.
- **User** (`users`): `schlId`, `name`, `email` (globally unique), `password` (`select: false`, bcrypt-hashed in a `pre("save")` hook — always save through the model, never write passwords with `updateOne`), `role`, `isActive`.
- **Role** (`roles`): `name`, `description`, `deleted` (soft delete), timestamps. `name` is unique among non-deleted roles (partial index). Seeded roles: admin, principal, teacher, accountant, librarian, student, parent.
- `User.role` is an **ObjectId ref to Role**. Populate it to get the name: `.populate<{ role: { name: string } | null }>("role", "name")`. The API returns `role` as the role *name* string to the frontend.
- A model used in `populate()` must be registered before the query runs. `user.model.ts` imports `./role.model.js` for this reason — when adding new refs, import the referenced model in the referencing model file, or you'll get `MissingSchemaError`.
- Soft-deleted documents (`deleted: true`) should be excluded from normal queries.
- **Module** (`modules`): the menu of a school, **one document per school** (`schlId` is unique). `modules` is an array of main menus `{ name, code, icon, path, order, isActive, deleted, subMenus: [...] }`; each submenu is `{ name, code, icon, path, order, isActive, deleted }`. Menus are displayed sorted by `order` ascending (main menus among themselves, submenus within their main menu); ties keep array order. `icon` is a lucide-react icon name. A main menu with submenus has an empty `path`. `code` must be unique across all main menus and submenus of a school (checked in a `pre("validate")` hook, since indexes can't enforce it inside an array). The seed adds the default menu to every school, adding only missing items.
- `GET /api/modules` (behind `protect`) returns the logged-in user's school menu, without inactive/deleted items (a hidden main menu hides its submenus).

## Auth

- `POST /api/auth/login` → signs a JWT `{ userId }`, sets it in an httpOnly `token` cookie (1 day, or 7 days with `rememberMe`). Same error message for wrong email and wrong password.
- `POST /api/auth/logout` clears the cookie. `GET /api/auth/me` (behind `protect`) returns the current user.
- Inactive users (`isActive: false`) get 403 at login and 401 from `/me`.
- Never return `password` or the token in a response body.
