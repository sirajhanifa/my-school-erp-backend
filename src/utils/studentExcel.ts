import ExcelJS from "exceljs";

import { GENDERS } from "../models/student.model.js";

// The columns of the student import file. "key" is the field name, "header" is what the user sees.
// A "*" in the header marks a required column (it is ignored when reading the file).
const COLUMNS = [
  { key: "admissionNo", header: "Admission No*", width: 16 },
  { key: "firstName", header: "First Name*", width: 18 },
  { key: "lastName", header: "Last Name", width: 18 },
  { key: "gender", header: "Gender*", width: 12 },
  { key: "dateOfBirth", header: "Date of Birth*", width: 16 },
  { key: "className", header: "Class*", width: 12 },
  { key: "sectionName", header: "Section*", width: 12 },
  { key: "guardianName", header: "Guardian Name", width: 22 },
  { key: "phone", header: "Phone", width: 16 },
  { key: "address", header: "Address", width: 30 },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

// One student row read from the file. "rowNo" is the Excel row number, used in error messages.
export type StudentExcelRow = Record<ColumnKey, string> & { rowNo: number };

// How many rows of the template get the dropdowns (Gender, Class, Section)
const TEMPLATE_ROWS = 1000;

// "Admission No*" -> "admission no", so headers match even with different case, spaces or "*"
const normalizeHeader = (text: string) =>
  text.replace(/\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();

// Builds the template file. Class and section dropdowns list the school's own names.
export const buildStudentTemplate = async (classNames: string[], sectionNames: string[]) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Students");

  sheet.columns = COLUMNS.map((column) => ({ ...column }));
  sheet.getRow(1).font = { bold: true };
  // Keeps the header row visible while scrolling
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  // One example row, so the user can see the expected format
  sheet.addRow({
    admissionNo: "1001",
    firstName: "Arun",
    lastName: "Kumar",
    gender: "Male",
    dateOfBirth: new Date(Date.UTC(2015, 5, 1)),
    className: classNames[0] ?? "",
    sectionName: sectionNames[0] ?? "",
    guardianName: "Ravi Kumar",
    phone: "9876543210",
    address: "12, Main Road",
  });

  // Show dates as YYYY-MM-DD
  sheet.getColumn("dateOfBirth").numFmt = "yyyy-mm-dd";

  // The dropdown values live on a hidden sheet, because Excel limits inline lists to 255 characters
  const lists = workbook.addWorksheet("Lists", { state: "hidden" });
  const listColumns = [
    { key: "gender", values: [...GENDERS] },
    { key: "className", values: classNames },
    { key: "sectionName", values: sectionNames },
  ] as const;

  listColumns.forEach((list, index) => {
    const column = lists.getColumn(index + 1);
    list.values.forEach((value, rowIndex) => {
      lists.getCell(rowIndex + 1, index + 1).value = value;
    });
    // An empty list would make an invalid dropdown, so skip it
    if (list.values.length === 0) return;

    const letter = column.letter;
    const formula = `Lists!$${letter}$1:$${letter}$${list.values.length}`;
    const studentColumn = sheet.getColumn(list.key).number;
    for (let row = 2; row <= TEMPLATE_ROWS + 1; row++) {
      sheet.getCell(row, studentColumn).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [formula],
      };
    }
  });

  return workbook.xlsx.writeBuffer();
};

// Turns one Excel cell into text. Dates become "YYYY-MM-DD" (Excel dates are read as UTC midnight).
const cellToText = (cell: ExcelJS.Cell) => {
  const value = cell.value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  // A formula cell holding a date
  if (value && typeof value === "object" && "result" in value && value.result instanceof Date) {
    return value.result.toISOString().slice(0, 10);
  }
  return cell.text.trim();
};

// Reads the first sheet of an uploaded file.
// Returns { error } if the file itself is unusable, otherwise { rows } (blank rows are skipped).
export const readStudentRows = async (buffer: Buffer) => {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    return { error: "Could not read the file. Please upload a valid .xlsx file." };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) return { error: "The file has no sheets" };

  // Find which Excel column holds each field, using the header row (so column order doesn't matter)
  const columnOf = new Map<ColumnKey, number>();
  sheet.getRow(1).eachCell((cell, columnNo) => {
    const header = normalizeHeader(cell.text);
    const column = COLUMNS.find((c) => normalizeHeader(c.header) === header);
    if (column) columnOf.set(column.key, columnNo);
  });

  const missing = COLUMNS.filter((c) => c.header.includes("*") && !columnOf.has(c.key));
  if (missing.length > 0) {
    const names = missing.map((c) => c.header.replace("*", "")).join(", ");
    return { error: `Missing columns: ${names}. Please use the template.` };
  }

  const rows: StudentExcelRow[] = [];
  sheet.eachRow((row, rowNo) => {
    if (rowNo === 1) return;

    const student = { rowNo } as StudentExcelRow;
    for (const column of COLUMNS) {
      const columnNo = columnOf.get(column.key);
      student[column.key] = columnNo ? cellToText(row.getCell(columnNo)) : "";
    }

    // Rows with only dropdowns or formatting but no values are not students
    const hasValue = COLUMNS.some((column) => student[column.key] !== "");
    if (hasValue) rows.push(student);
  });

  return { rows };
};
