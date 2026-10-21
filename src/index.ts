// Must be the first import so .env values are loaded before any other file reads process.env
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";

import connectDB from "./config/db.js";
import routes from "./routes/index.js";

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Log every incoming request (method + URL) so we can see what the API is receiving
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use(express.json());
app.use(cookieParser()); // lets us read cookies with req.cookies

connectDB();

app.get("/", (_req, res) => {
  res.json({ message: "MySchool ERP API is running" });
});

// All API routes live under /api (see routes/index.ts)
app.use("/api", routes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
