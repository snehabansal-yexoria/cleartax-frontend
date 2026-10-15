"use client";

export type ExportFormat = "csv" | "excel" | "pdf";

export type ExportColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

export type ExportRequest<T> = {
  title: string;
  filename: string;
  columns: ExportColumn<T>[];
  rows: readonly T[];
  /** Short lines printed under the title, e.g. the active filters. */
  context?: string[];
};

function cell(value: string | number | null | undefined) {
  return value == null ? "" : String(value);
}

function escapeCsv(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function download(content: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function tableHtml<T>({ title, columns, rows, context = [] }: ExportRequest<T>) {
  const head = columns.map((column) => `<th>${escapeHtml(column.header)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(cell(column.value(row)))}</td>`).join("")}</tr>`)
    .join("");
  const meta = context.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
  return `<h1>${escapeHtml(title)}</h1>${meta}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function exportRows<T>(format: ExportFormat, request: ExportRequest<T>) {
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `${request.filename}-${stamp}`;

  if (format === "csv") {
    const lines = [
      request.columns.map((column) => escapeCsv(column.header)).join(","),
      ...request.rows.map((row) =>
        request.columns.map((column) => escapeCsv(cell(column.value(row)))).join(","),
      ),
    ];
    // BOM so Excel opens UTF-8 (names with accents, the en dash) correctly.
    download(`﻿${lines.join("\r\n")}`, "text/csv;charset=utf-8", `${base}.csv`);
    return;
  }

  if (format === "excel") {
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>${tableHtml(request)}</body></html>`;
    download(html, "application/vnd.ms-excel;charset=utf-8", `${base}.xls`);
    return;
  }

  const printable = window.open("", "_blank", "noopener=no,width=1100,height=800");
  if (!printable) return;
  printable.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(request.title)}</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;color:#16181d;margin:32px;font-size:12px}
  h1{font-family:"Public Sans",Inter,sans-serif;font-size:20px;margin:0 0 6px}
  p{margin:0 0 4px;color:#5b6170}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#5b6170;border-bottom:1px solid #d6d3cc;padding:6px 8px}
  td{border-bottom:1px solid #efede8;padding:6px 8px}
</style></head><body>${tableHtml(request)}<p style="margin-top:16px">Exported ${escapeHtml(new Date().toLocaleString("en-AU"))}</p></body></html>`);
  printable.document.close();
  printable.focus();
  printable.print();
}
