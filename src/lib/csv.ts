export type CsvRow = Record<string, string>;

function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function parseCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<CsvRow>((row, header, index) => {
      row[header] = values[index] || "";
      return row;
    }, {});
  });
}

function parseLooseLine(line: string, columnCount: number) {
  if (line.includes(",")) {
    const values = parseCsvLine(line);
    if (values.length <= columnCount) {
      return values;
    }

    return [
      ...values.slice(0, columnCount - 1),
      values.slice(columnCount - 1).join(" ").trim(),
    ];
  }

  if (line.includes("\t")) {
    const values = line.split("\t").map((value) => value.trim());
    if (values.length <= columnCount) {
      return values;
    }

    return [
      ...values.slice(0, columnCount - 1),
      values.slice(columnCount - 1).join(" ").trim(),
    ];
  }

  const wideSplit = line
    .split(/\s{2,}/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (wideSplit.length >= columnCount) {
    if (wideSplit.length === columnCount) {
      return wideSplit;
    }

    return [
      ...wideSplit.slice(0, columnCount - 1),
      wideSplit.slice(columnCount - 1).join(" ").trim(),
    ];
  }

  const compactSplit = line
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (compactSplit.length <= columnCount) {
    if (compactSplit.length === columnCount || compactSplit.length < columnCount) {
      if (compactSplit.length < columnCount && compactSplit.length > 2) {
        return [
          ...compactSplit.slice(0, columnCount - 1),
          compactSplit.slice(columnCount - 1).join(" ").trim(),
        ];
      }

      return compactSplit;
    }
  }

  return [
    ...compactSplit.slice(0, columnCount - 1),
    compactSplit.slice(columnCount - 1).join(" ").trim(),
  ];
}

function rowLooksLikeHeader(values: string[], expectedHeaders: string[]) {
  if (values.length === 0) {
    return false;
  }

  return values.every((value) =>
    expectedHeaders.includes(normalizeHeader(value)),
  );
}

export function parseFlexibleRows(text: string, defaultHeaders: string[]) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const firstRow = parseLooseLine(lines[0], defaultHeaders.length);
  const hasHeader = rowLooksLikeHeader(firstRow, defaultHeaders);
  const headers = hasHeader
    ? firstRow.map(normalizeHeader)
    : defaultHeaders.map(normalizeHeader);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const values = parseLooseLine(line, headers.length);

    return headers.reduce<CsvRow>((row, header, index) => {
      row[header] = (values[index] || "").trim();
      return row;
    }, {});
  });
}

/**
 * Tokenize a CSV while preserving the ORIGINAL file line number of every row.
 *
 * `parseCsv` above drops blank lines and splits on newlines before tokenizing.
 * Both are fine for its existing callers and wrong for an import that reports
 * per-row errors: an error that says "row 14" when the accountant's spreadsheet
 * shows row 16 costs more support time than the import saves, and a quoted
 * field containing a newline (a Description pasted from another system) is
 * silently corrupted.
 *
 * This walks the text character by character, so a newline inside quotes stays
 * inside the field, and it emits blank rows rather than discarding them so the
 * line numbering never shifts.
 */
export function parseCsvWithLines(
  text: string,
): { line: number; values: string[] }[] {
  const src = text.replace(/^﻿/, "");
  const out: { line: number; values: string[] }[] = [];

  let values: string[] = [];
  let current = "";
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;

  const endField = () => {
    values.push(current.trim());
    current = "";
  };
  const endRow = () => {
    endField();
    out.push({ line: rowStartLine, values });
    values = [];
    rowStartLine = line + 1;
  };

  for (let i = 0; i < src.length; i += 1) {
    const char = src[i];
    const next = src[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (inQuotes) {
      if (char === "\n") line += 1;
      current += char;
      continue;
    }

    if (char === ",") {
      endField();
      continue;
    }

    if (char === "\r") continue;

    if (char === "\n") {
      endRow();
      line += 1;
      continue;
    }

    current += char;
  }

  // Trailing row with no final newline.
  if (current !== "" || values.length > 0) endRow();

  return out;
}
