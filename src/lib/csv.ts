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
