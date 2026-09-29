import express from "express";
import dotenv from "dotenv";

import connectDB from "./config/db.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(express.json());

connectDB();

app.get("/", (_req, res) => {
  res.json({ message: "MySchool ERP API is running" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
