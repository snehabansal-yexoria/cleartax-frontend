"use client";

import { useEffect, useRef, useState } from "react";

export type ExportColumn<T> = { header: string; value: (row: T) => string | number | null | undefined };

type Props<T> = {
  /** File name without extension, e.g. "clients". */
  filename: string;
  columns: ExportColumn<T>[];
  /** Rows currently shown (after search and filters). */
  visibleRows: T[];
  /** Every row; when given, the menu offers "only the rows shown". */
  allRows?: T[];
  label?: string;
};

const cellText = (value: string | number | null | undefined) => (value == null ? "" : String(value));

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportCsv<T>(filename: string, columns: ExportColumn<T>[], rows: T[]) {
  const escape = (text: string) => (/[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
  const lines = [columns.map((c) => escape(c.header)).join(","), ...rows.map((row) => columns.map((c) => escape(cellText(c.value(row)))).join(","))];
  download(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
}

/** One workbook; each sheet is { name, columns, rows }. */
export async function exportXlsx(filename: string, sheets: { name: string; columns: ExportColumn<unknown>[]; rows: unknown[] }[]) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name.slice(0, 31));
    ws.addRow(sheet.columns.map((c) => c.header)).font = { bold: true };
    for (const row of sheet.rows) ws.addRow(sheet.columns.map((c) => c.value(row) ?? ""));
    ws.columns.forEach((column) => {
      column.width = 20;
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  download(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${filename}.xlsx`);
}

/** Header "Export ▾" button with a CSV / Excel menu, matching the admin buttons. */
export default function ExportMenu<T>({ filename, columns, visibleRows, allRows, label = "Export" }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [onlyShown, setOnlyShown] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const rows = !allRows || onlyShown ? visibleRows : allRows;

  async function run(kind: "csv" | "xlsx") {
    setOpen(false);
    if (kind === "csv") exportCsv(filename, columns, rows);
    else await exportXlsx(filename, [{ name: filename, columns: columns as ExportColumn<unknown>[], rows }]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm cursor-pointer"
      >
        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
        {label} ▾
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-1.5 flex flex-col gap-0.5">
          <button type="button" onClick={() => run("csv")} className="flex justify-between items-center px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
            CSV <span className="text-xs font-normal text-slate-400">.csv</span>
          </button>
          <button type="button" onClick={() => run("xlsx")} className="flex justify-between items-center px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
            Excel <span className="text-xs font-normal text-slate-400">.xlsx</span>
          </button>
          {allRows && allRows.length !== visibleRows.length ? (
            <>
              <div className="h-px bg-slate-100 my-1 mx-1" />
              <label className="flex items-center gap-2 px-3 py-2 text-xs text-slate-600 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={onlyShown} onChange={(event) => setOnlyShown(event.target.checked)} />
                Only the {visibleRows.length} rows shown by filters
              </label>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
