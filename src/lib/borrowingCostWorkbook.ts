import type { Borders, Fill, Worksheet } from "exceljs";

/**
 * Builds the Borrowing Cost worksheet as a real .xlsx.
 *
 * The supplied template is a styled worksheet — merged label blocks, a bordered
 * sign-off box, currency formats, fills on specific cells — none of which a CSV
 * can carry, which is why the browser-built `data:text/csv` string this
 * replaces could never match it.
 *
 * It is built client-side with exceljs rather than server-side with the Go
 * `excelize` dependency because every value already exists in
 * BorrowingCostView: the amortisation schedule is computed in that component,
 * so a Go writer would mean porting the whole calculation across a language
 * boundary purely to format a file. `internal/export/writers.go` is also a flat
 * unstyled single-sheet writer that could not render this layout anyway.
 *
 * Layout (1-indexed, matching the template exactly):
 *   1-3    header block: Client / Year end on the left, the Prep by / Rev by
 *          sign-off box on the right (D1:F3, no data source — deliberately
 *          blank for a wet signature)
 *   7      "List of Borrowing expense"
 *   9-16   one row per borrowing expense subcategory (B:C merged) + one spare
 *   19     Total
 *   22-25  loan parameters
 *   27-34  the amortisation schedule + total row
 */

export type BorrowingCostScheduleRow = {
  /** Plain financial-year end year — the template's Year column is "2026", not "FY 2025–26". */
  fyEndYear: number;
  days: number;
  cost: number;
  closingBalance: number;
};

export type BorrowingCostWorkbookInput = {
  clientName: string;
  propertyName: string;
  /** Fixed subcategory list, in template order; amount is null when nothing was entered. */
  expenses: Array<{ name: string; amount: number | null }>;
  totalBorrowingCost: number;
  /** YYYY-MM-DD, blank when the accountant has not filled the loan dates in. */
  loanStartDate: string;
  loanEndDate: string;
  periodEndDate: string;
  daysCurrentYear: number;
  schedule: BorrowingCostScheduleRow[];
  totalScheduleDays: number;
};

/**
 * Money is rounded to cents on the way in.
 *
 * The final period's cost is derived as `total - sum(previous)`, so it carries
 * float residue (947.4300000000003). The number format would hide it, but the
 * stored value is what an accountant gets when they click the cell or build a
 * formula on it.
 */
function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/** `$ 5,000.00`, negatives in red — the template's own money format. */
const MONEY_FORMAT = '"$ "#,##0.00;[Red]"$ "-#,##0.00';
const DATE_FORMAT = "dd/mm/yyyy";

const THIN_BORDER: Partial<Borders> = {
  top: { style: "thin", color: { argb: "FF000000" } },
  left: { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  right: { style: "thin", color: { argb: "FF000000" } },
};

const GREY_FILL: Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD9D9D9" },
};

const LIGHT_FILL: Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF1F3F4" },
};

const GREEN_FILL: Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFB6D7A8" },
};

/**
 * Excel stores a date as a day count, so a local-midnight Date can land on the
 * previous day once exceljs reads it as UTC. Anchoring at UTC noon puts every
 * timezone safely inside the same day.
 */
function toExcelDate(iso: string): Date | null {
  const parts = iso.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** 30 June of the given financial year — the template's "Year end" cell. */
function financialYearEnd(fyEndYear: number): Date {
  return new Date(Date.UTC(fyEndYear, 5, 30, 12));
}

function labelCell(sheet: Worksheet, address: string, text: string) {
  const cell = sheet.getCell(address);
  cell.value = text;
  cell.font = { name: "Calibri", size: 10, bold: true };
  return cell;
}

export async function buildBorrowingCostWorkbook(
  input: BorrowingCostWorkbookInput,
): Promise<Blob> {
  // Loaded on demand so exceljs (~1MB) is code-split out of the page bundle and
  // only fetched when someone actually exports. The dynamic import also keeps
  // the Node-flavoured entry point out of the server render.
  // exceljs is CommonJS. Node's ESM loader exposes its exports only under
  // `default` (the namespace has just `default` and `module.exports`), while a
  // bundler resolving the `browser` UMD build re-exports them by name too. Take
  // whichever shape actually carries the constructor rather than assuming one.
  const mod = await import("exceljs");
  const ExcelJS = mod.default ?? mod;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Clear Portfolio";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Borrowing Cost", {
    views: [{ showGridLines: true }],
  });

  sheet.columns = [
    { key: "a", width: 13 },
    { key: "b", width: 35 },
    { key: "c", width: 14 },
    { key: "d", width: 15 },
    { key: "e", width: 14 },
    { key: "f", width: 14 },
  ];
  sheet.properties.defaultRowHeight = 15;

  // ---- Header block --------------------------------------------------------
  labelCell(sheet, "A1", "Client:");
  labelCell(sheet, "A2", "Year end:");

  const clientCell = sheet.getCell("B1");
  clientCell.value = input.clientName;
  clientCell.font = { name: "Calibri", size: 10, bold: true };

  const yearEndCell = sheet.getCell("B2");
  // Year end is the FY the schedule opens in — the first period always ends on
  // 30 June, which is exactly what the template's cell shows.
  if (input.schedule.length > 0) {
    yearEndCell.value = financialYearEnd(input.schedule[0].fyEndYear);
    yearEndCell.numFmt = DATE_FORMAT;
  }
  yearEndCell.font = { name: "Calibri", size: 10, bold: true };

  for (const address of ["A1", "B1", "A2", "B2"]) {
    sheet.getCell(address).border = THIN_BORDER;
  }

  // Sign-off box. Intentionally empty: initials and dates are added by hand
  // after printing, and there is no field anywhere in the app to fill them from.
  const initials = labelCell(sheet, "E1", "Initials");
  initials.alignment = { horizontal: "center" };
  const dateHeader = labelCell(sheet, "F1", "Date");
  dateHeader.alignment = { horizontal: "center" };
  const prepBy = labelCell(sheet, "D2", "Prep by:");
  prepBy.alignment = { horizontal: "right" };
  const revBy = labelCell(sheet, "D3", "Rev by:");
  revBy.alignment = { horizontal: "right" };

  for (const row of [1, 2, 3]) {
    for (const col of ["D", "E", "F"]) {
      const cell = sheet.getCell(`${col}${row}`);
      cell.border = THIN_BORDER;
      if (col !== "D" && row > 1) {
        cell.fill = LIGHT_FILL;
      }
    }
  }

  // ---- Expense list --------------------------------------------------------
  const heading = sheet.getCell("B7");
  heading.value = "List of Borrowing expense";
  heading.font = { name: "Calibri", size: 10, bold: true, underline: true };

  const EXPENSE_FIRST_ROW = 9;
  // The template carries one spare blank row under the seeded subcategories so
  // an accountant can pencil in a cost the chart of accounts does not have.
  const expenseRowCount = input.expenses.length + 1;

  for (let i = 0; i < expenseRowCount; i++) {
    const rowNumber = EXPENSE_FIRST_ROW + i;
    const expense = input.expenses[i];

    sheet.mergeCells(`B${rowNumber}:C${rowNumber}`);
    const nameCell = sheet.getCell(`B${rowNumber}`);
    nameCell.value = expense ? expense.name : "";
    nameCell.font = { name: "Calibri", size: 10 };
    nameCell.fill = LIGHT_FILL;
    nameCell.border = THIN_BORDER;
    sheet.getCell(`C${rowNumber}`).border = THIN_BORDER;

    const amountCell = sheet.getCell(`D${rowNumber}`);
    // A subcategory with no transaction stays blank rather than showing $0.00,
    // which is how the template renders Bill Of Sale Search Fee.
    if (expense && expense.amount !== null) {
      amountCell.value = money(expense.amount);
      amountCell.numFmt = MONEY_FORMAT;
    }
    amountCell.font = { name: "Calibri", size: 10 };
    amountCell.fill = LIGHT_FILL;
    amountCell.border = THIN_BORDER;
  }

  const TOTAL_ROW = EXPENSE_FIRST_ROW + expenseRowCount + 2;
  sheet.mergeCells(`B${TOTAL_ROW}:C${TOTAL_ROW}`);
  const totalLabel = sheet.getCell(`B${TOTAL_ROW}`);
  totalLabel.value = "Total";
  totalLabel.font = { name: "Calibri", size: 10, bold: true };
  totalLabel.alignment = { horizontal: "center" };
  totalLabel.fill = GREY_FILL;
  totalLabel.border = THIN_BORDER;
  sheet.getCell(`C${TOTAL_ROW}`).border = THIN_BORDER;

  const totalValue = sheet.getCell(`D${TOTAL_ROW}`);
  totalValue.value = money(input.totalBorrowingCost);
  totalValue.numFmt = MONEY_FORMAT;
  totalValue.font = { name: "Calibri", size: 10, bold: true };
  totalValue.border = THIN_BORDER;

  // ---- Loan parameters -----------------------------------------------------
  const LOAN_FIRST_ROW = TOTAL_ROW + 3;
  const loanRows: Array<[string, Date | number | null]> = [
    ["Loan Start date", toExcelDate(input.loanStartDate)],
    ["Loan End date", toExcelDate(input.loanEndDate)],
    ["Period end date", toExcelDate(input.periodEndDate)],
    ["No of day CY", input.daysCurrentYear],
  ];

  loanRows.forEach(([label, value], i) => {
    const rowNumber = LOAN_FIRST_ROW + i;
    labelCell(sheet, `B${rowNumber}`, label);

    const valueCell = sheet.getCell(`C${rowNumber}`);
    if (value instanceof Date) {
      valueCell.value = value;
      valueCell.numFmt = DATE_FORMAT;
    } else if (typeof value === "number") {
      valueCell.value = value;
    }
    valueCell.font = { name: "Calibri", size: 10 };
    valueCell.alignment = { horizontal: "right" };
    valueCell.fill = LIGHT_FILL;
  });

  // ---- Amortisation schedule ----------------------------------------------
  // One blank row between the loan parameters and the schedule header, which
  // puts the header on row 27 exactly as the template does.
  const SCHEDULE_HEADER_ROW = LOAN_FIRST_ROW + loanRows.length + 1;
  const scheduleHeaders = ["Year", "Days", "Amount", "Cl.Balance"];

  scheduleHeaders.forEach((text, i) => {
    const cell = sheet.getCell(SCHEDULE_HEADER_ROW, 2 + i);
    cell.value = text;
    cell.font = { name: "Calibri", size: 10, bold: true };
    cell.alignment = { horizontal: "center" };
    cell.fill = GREY_FILL;
    cell.border = THIN_BORDER;
  });

  input.schedule.forEach((period, i) => {
    const rowNumber = SCHEDULE_HEADER_ROW + 1 + i;
    const isLast = i === input.schedule.length - 1;

    const yearCell = sheet.getCell(rowNumber, 2);
    yearCell.value = period.fyEndYear;
    yearCell.alignment = { horizontal: "center" };

    const daysCell = sheet.getCell(rowNumber, 3);
    daysCell.value = period.days;
    daysCell.alignment = { horizontal: "right" };

    const costCell = sheet.getCell(rowNumber, 4);
    costCell.value = money(period.cost);
    costCell.numFmt = MONEY_FORMAT;

    const balanceCell = sheet.getCell(rowNumber, 5);
    balanceCell.value = money(period.closingBalance);
    balanceCell.numFmt = MONEY_FORMAT;
    if (i === 0) {
      // The template highlights the first year's closing balance — it is the
      // figure that carries into next year's working paper.
      balanceCell.fill = GREEN_FILL;
    }
    if (isLast) {
      // Fully amortised. Red because a non-zero value here is an error.
      balanceCell.font = { name: "Calibri", size: 10, color: { argb: "FFFF0000" } };
    }

    for (let col = 2; col <= 5; col++) {
      const cell = sheet.getCell(rowNumber, col);
      cell.border = THIN_BORDER;
      if (!cell.font) cell.font = { name: "Calibri", size: 10 };
    }
  });

  const scheduleTotalRow = SCHEDULE_HEADER_ROW + 1 + input.schedule.length;
  const totalDays = sheet.getCell(scheduleTotalRow, 3);
  totalDays.value = input.totalScheduleDays;
  totalDays.alignment = { horizontal: "right" };
  totalDays.font = { name: "Calibri", size: 10, bold: true };

  const totalCost = sheet.getCell(scheduleTotalRow, 4);
  totalCost.value = money(input.totalBorrowingCost);
  totalCost.numFmt = MONEY_FORMAT;
  totalCost.font = { name: "Calibri", size: 10, bold: true };

  for (let col = 2; col <= 5; col++) {
    const cell = sheet.getCell(scheduleTotalRow, col);
    cell.border = {
      ...THIN_BORDER,
      top: { style: "medium", color: { argb: "FF000000" } },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
