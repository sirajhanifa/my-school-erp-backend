import type { NextFunction, Request, Response } from "express";
import multer from "multer";

// Biggest Excel file we accept (2 MB is plenty for a few thousand students)
const MAX_FILE_SIZE = 2 * 1024 * 1024;

// Keeps the file in memory (req.file.buffer), since we only read it once and never store it
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, callback) => {
    // Only .xlsx files; any other file is skipped and req.file stays empty
    callback(null, file.originalname.toLowerCase().endsWith(".xlsx"));
  },
}).single("file");

// Reads one .xlsx file from the "file" form field.
// Upload problems (too big, wrong field) become a 400 with a clear message instead of a 500.
export const uploadExcel = (req: Request, res: Response, next: NextFunction) => {
  excelUpload(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "The file is too large. The maximum size is 2 MB."
          : "Could not read the uploaded file";
      return res.status(400).json({ message });
    }
    if (error) return next(error);

    if (!req.file) {
      return res.status(400).json({ message: "Please choose an Excel (.xlsx) file" });
    }
    next();
  });
};
