import { parseCsvWithLines } from "@/src/lib/csv";
import {
  gstCodeAllowedFor,
  isPostableCategory,
  normalizeGstCode,
} from "@/src/lib/journalGst";
import type { CoreChartAccount, CoreProperty } from "@/src/lib/coreApi";

/**
 * Journal-entry CSV: column spec, parsing, grouping and validation.
 *
 * Everything here is pure, so the same code backs BOTH the Bulk Upload tab and
 * the manual grid's spreadsheet paste — an accountant pasting ten rows from
 * Excel goes through exactly the validation an uploaded file does.
 */

/**
 * The client's exact header row, plus one optional trailing column.
 *
 * The template is emitted from this constant and the parser's stems are derived
 * from it, so the two cannot drift.
 */
export const JOURNAL_CSV_HEADER = [
  "Journal Date (YYYY-MM-DD)",
  "Property Name",
  "Account Code (Number)",
  "Account Name (Text)",
  "Debit (GST-exclusive number)",
  "Credit (GST-exclusive number)",
  "Description (Text)",
  "Name (Text)",
  "GST Code (GST Free 0% Sales / GST 10% Sales / GST Free Purchases 0% / GST on Purchases 10% / Out of Scope 0% Purchases / Out of Scope 0% Sales)",
  "Entry Reference (optional)",
] as const;

export type JournalCsvField =
  | "journalDate"
  | "propertyName"
  | "accountCode"
  | "accountName"
  | "debit"
  | "credit"
  | "description"
  | "name"
  | "gstCode"
  | "reference";

/**
 * Columns are matched by CANONICAL STEM, not by the full header text.
 *
 * The GST column's header is 130 characters and changes identity with one extra
 * space, so indexing on it would break on a file the client edited in Excel.
 * The stem is everything before the first "(", normalised — "gst code" here —
 * and the stems are unique (note "account_name" and "name" do not collide,
 * because matching is exact on the stem).
 */
const COLUMN_SPEC: {
  key: JournalCsvField;
  stem: string;
  required: boolean;
}[] = [
  { key: "journalDate", stem: "journal date", required: true },
  { key: "propertyName", stem: "property name", required: false },
  { key: "accountCode", stem: "account code", required: true },
  { key: "accountName", stem: "account name", required: false },
  { key: "debit", stem: "debit", required: true },
  { key: "credit", stem: "credit", required: true },
  { key: "description", stem: "description", required: false },
  { key: "name", stem: "name", required: false },
  { key: "gstCode", stem: "gst code", required: false },
  { key: "reference", stem: "entry reference", required: false },
];

function canonicalStem(header: string): string {
  const beforeParen = header.split("(")[0] ?? header;
  return beforeParen.trim().toLowerCase().split(/\s+/).join(" ");
}

export interface JournalCsvRow {
  /** 1-based line in the original file, so an error points where Excel does. */
  line: number;
  journalDate: string;
  propertyName: string;
  accountCode: string;
  accountName: string;
  debit: string;
  credit: string;
  description: string;
  name: string;
  gstCode: string;
  reference: string;
}

export interface JournalCsvParseResult {
  rows: JournalCsvRow[];
  /** True when the header was unrecognised and columns were read positionally. */
  positional: boolean;
  error?: string;
}

/** Parse a CSV file into journal rows, matching columns by name in any order. */
export function parseJournalCsv(text: string): JournalCsvParseResult {
  const raw = parseCsvWithLines(text);
  const nonBlank = raw.filter((r) => r.values.some((v) => v !== ""));
  if (nonBlank.length === 0) {
    return { rows: [], positional: false, error: "That file has no rows." };
  }

  const headerRow = nonBlank[0];
  const stems = headerRow.values.map(canonicalStem);

  const index: Partial<Record<JournalCsvField, number>> = {};
  for (const spec of COLUMN_SPEC) {
    const at = stems.indexOf(spec.stem);
    if (at >= 0) index[spec.key] = at;
  }

  const missing = COLUMN_SPEC.filter(
    (s) => s.required && index[s.key] === undefined,
  );

  let positional = false;
  if (missing.length > 0) {
    // Fall back to reading columns in order when the header is unrecognisable
    // but the shape is right. The UI says so rather than importing silently.
    if (headerRow.values.length >= 9) {
      positional = true;
      COLUMN_SPEC.forEach((spec, i) => {
        index[spec.key] = i;
      });
    } else {
      return {
        rows: [],
        positional: false,
        error: `That file is missing required columns: ${missing
          .map((m) => m.stem)
          .join(", ")}. Download the template to see the expected format.`,
      };
    }
  }

  const at = (values: string[], key: JournalCsvField): string => {
    const i = index[key];
    return i === undefined ? "" : (values[i] ?? "").trim();
  };

  const rows: JournalCsvRow[] = [];
  for (const record of raw) {
    if (record.line === headerRow.line) continue;
    if (!record.values.some((v) => v !== "")) continue; // blank line, skipped
    rows.push({
      line: record.line,
      journalDate: at(record.values, "journalDate"),
      propertyName: at(record.values, "propertyName"),
      accountCode: at(record.values, "accountCode"),
      accountName: at(record.values, "accountName"),
      debit: at(record.values, "debit"),
      credit: at(record.values, "credit"),
      description: at(record.values, "description"),
      name: at(record.values, "name"),
      gstCode: at(record.values, "gstCode"),
      reference: at(record.values, "reference"),
    });
  }

  return { rows, positional };
}

/** Emit the template, header and sample rows, from the same constants. */
export function journalCsvTemplate(): string {
  const sample = [
    ["2026-06-30", "12 Smith St", "5010", "Repairs and maintenance", "200.00", "", "June repairs accrual", "Jim's Plumbing", "GST on Purchases 10%", "YE-ADJ-01"],
    ["2026-06-30", "", "2100", "Accounts Payable", "", "200.00", "June repairs accrual", "Jim's Plumbing", "", "YE-ADJ-01"],
    ["2026-06-30", "12 Smith St", "5010", "Repairs and maintenance", "", "50.00", "Overcharge credited back", "Jim's Plumbing", "GST on Purchases 10%", "YE-ADJ-02"],
    ["2026-06-30", "", "2100", "Accounts Payable", "50.00", "", "Overcharge credited back", "Jim's Plumbing", "", "YE-ADJ-02"],
  ];
  const quote = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [
    JOURNAL_CSV_HEADER.map(quote).join(","),
    ...sample.map((r) => r.map(quote).join(",")),
  ].join("\n");
}

// =============================================================================
// Amounts and dates
// =============================================================================

/** Tolerate the decoration a spreadsheet adds; reject anything else. */
export function parseCsvMoney(raw: string): { value: number; ok: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: 0, ok: true };

  let negative = false;
  let s = trimmed;
  if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$,\s ]/g, "");
  if (!s) return { value: 0, ok: true };

  const v = Number.parseFloat(s);
  if (!Number.isFinite(v)) return { value: 0, ok: false };
  return { value: Math.round((negative ? -v : v) * 100) / 100, ok: true };
}

/** Accept ISO plus the two day-first forms an Australian spreadsheet emits. */
export function normalizeCsvDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return isRealDate(+iso[1], +iso[2], +iso[3]) ? s : null;

  const dayFirst = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (dayFirst) {
    const [, d, m, y] = dayFirst;
    if (!isRealDate(+y, +m, +d)) return null;
    return `${y}-${String(+m).padStart(2, "0")}-${String(+d).padStart(2, "0")}`;
  }
  return null;
}

function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= dim;
}

// =============================================================================
// Validation and grouping
// =============================================================================

export interface JournalCsvIssue {
  line: number;
  field?: JournalCsvField;
  reason: string;
}

/** One grouped entry, ready to preview or send. */
export interface JournalCsvEntry {
  index: number;
  lines: number[];
  entryDate: string;
  reference: string;
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
  issues: JournalCsvIssue[];
  rows: JournalCsvRow[];
}

export interface JournalCsvValidation {
  entries: JournalCsvEntry[];
  /** Keyed `${line}:${field}` so a cell can be tinted directly. */
  cellErrors: Map<string, string>;
  okEntryCount: number;
  okLineCount: number;
  errorEntryCount: number;
  errorLineCount: number;
}

const MAX_ENTRY_LINES = 200;

/**
 * Validate every row and group rows into entries.
 *
 * Grouping is the genuine ambiguity in the client's format: the header carries
 * no entry id, and balance is a per-entry property. Two rules, in order:
 *
 *  1. When a row carries an Entry Reference, consecutive rows sharing the same
 *     (date, reference) are one entry. This is the reliable path, and the
 *     reason the template ships that optional column.
 *
 *  2. Otherwise a running-balance walk: close the entry as soon as debits equal
 *     credits. A date change force-closes the open entry as an error rather
 *     than merging across dates, and an entry is capped — both guards stop one
 *     malformed row cascading into "everything after it is one giant entry".
 *
 * The UI renders the resulting grouping as a visible gutter before anything is
 * imported: a grouping heuristic the accountant cannot see is one they cannot
 * trust.
 */
export function validateJournalCsv(
  rows: JournalCsvRow[],
  accounts: CoreChartAccount[],
  properties: CoreProperty[],
): JournalCsvValidation {
  const accountByCode = new Map(
    accounts.map((a) => [a.accountCode.trim().toUpperCase(), a]),
  );
  const propertyByName = new Map(
    properties.map((p) => [p.name.trim().toLowerCase(), p]),
  );

  const cellErrors = new Map<string, string>();
  const entries: JournalCsvEntry[] = [];

  let current: JournalCsvEntry | null = null;
  let debit = 0;
  let credit = 0;

  const round2 = (v: number) => Math.round(v * 100) / 100;

  const close = () => {
    if (!current) return;
    current.totalDebit = round2(debit);
    current.totalCredit = round2(credit);
    current.balanced =
      current.totalDebit === current.totalCredit && current.totalDebit > 0;
    if (!current.balanced) {
      current.issues.push({
        line: current.lines[0] ?? 0,
        reason:
          current.totalDebit === 0 && current.totalCredit === 0
            ? "This entry has no amounts."
            : `This entry is out of balance by ${Math.abs(
                current.totalDebit - current.totalCredit,
              ).toFixed(2)} — debits must equal credits.`,
      });
    }
    entries.push(current);
    current = null;
    debit = 0;
    credit = 0;
  };

  for (const row of rows) {
    const issues: JournalCsvIssue[] = [];
    const addIssue = (field: JournalCsvField | undefined, reason: string) => {
      issues.push({ line: row.line, field, reason });
      if (field) cellErrors.set(`${row.line}:${field}`, reason);
    };

    const date = normalizeCsvDate(row.journalDate);
    if (!date) {
      addIssue("journalDate", `"${row.journalDate}" is not a valid date.`);
    }

    const code = row.accountCode.trim().toUpperCase();
    const account = accountByCode.get(code);
    if (!code) {
      addIssue("accountCode", "Account code is required.");
    } else if (!account) {
      addIssue(
        "accountCode",
        `"${row.accountCode}" is not in the chart of accounts.`,
      );
    } else if (!account.isActive) {
      addIssue("accountCode", `${row.accountCode} is inactive.`);
    }

    if (account && row.accountName.trim()) {
      // A mismatched Account Name is a WARNING, never an error: the spec calls
      // it auto-populated, so the code wins and the import proceeds.
      if (
        account.accountName.trim().toLowerCase() !==
        row.accountName.trim().toLowerCase()
      ) {
        cellErrors.set(
          `${row.line}:accountName`,
          `Will be saved as "${account.accountName}" — the account code decides the name.`,
        );
      }
    }

    const d = parseCsvMoney(row.debit);
    const c = parseCsvMoney(row.credit);
    if (!d.ok) addIssue("debit", `"${row.debit}" is not a number.`);
    if (!c.ok) addIssue("credit", `"${row.credit}" is not a number.`);
    if (d.ok && c.ok) {
      if (d.value === 0 && c.value === 0) {
        addIssue("debit", "Enter either a debit or a credit.");
      } else if (d.value !== 0 && c.value !== 0) {
        addIssue("debit", "A line cannot have both a debit and a credit.");
      } else if (d.value < 0 || c.value < 0) {
        addIssue(
          "debit",
          "Amounts cannot be negative. To reduce an account, put the amount on the other side.",
        );
      }
    }

    if (account) {
      const postable = isPostableCategory(account.category);
      const gst = row.gstCode.trim();
      const normalized = gst ? normalizeGstCode(gst) : null;

      if (postable) {
        if (!gst) {
          addIssue("gstCode", "GST code is required on an income or expense account.");
        } else if (!normalized) {
          addIssue("gstCode", `"${gst}" is not one of the approved GST codes.`);
        } else {
          const check = gstCodeAllowedFor(account.category, normalized);
          if (!check.ok) addIssue("gstCode", check.reason ?? "Invalid GST code.");
        }
        const propName = row.propertyName.trim();
        if (!propName) {
          addIssue("propertyName", "Property is required on an income or expense account.");
        } else if (!propertyByName.has(propName.toLowerCase())) {
          addIssue(
            "propertyName",
            `"${propName}" is not a property of this entity.`,
          );
        }
      } else {
        if (gst) {
          addIssue("gstCode", `A ${account.category} account does not take a GST code.`);
        }
        if (row.propertyName.trim()) {
          addIssue(
            "propertyName",
            `A ${account.category} account does not take a property.`,
          );
        }
      }
    }

    const entryDate = date ?? row.journalDate.trim();
    const reference = row.reference.trim();

    if (current) {
      const cur: JournalCsvEntry = current;
      let sameGroup = cur.entryDate === entryDate;
      if (reference || cur.reference) {
        sameGroup = sameGroup && cur.reference === reference;
      }
      if (!sameGroup || cur.rows.length >= MAX_ENTRY_LINES) {
        close();
      }
    }

    if (!current) {
      current = {
        index: entries.length + 1,
        lines: [],
        entryDate,
        reference,
        totalDebit: 0,
        totalCredit: 0,
        balanced: false,
        issues: [],
        rows: [],
      };
    }

    const entry: JournalCsvEntry = current;
    entry.lines.push(row.line);
    entry.rows.push(row);
    entry.issues.push(...issues);

    if (issues.length === 0) {
      debit = round2(debit + d.value);
      credit = round2(credit + c.value);
    }

    // With no reference to group by, a balanced running total ends the entry.
    if (!reference && debit === credit && debit > 0) close();
  }

  close();

  let okEntryCount = 0;
  let okLineCount = 0;
  let errorEntryCount = 0;
  let errorLineCount = 0;
  for (const e of entries) {
    if (e.issues.length === 0 && e.balanced) {
      okEntryCount += 1;
      okLineCount += e.rows.length;
    } else {
      errorEntryCount += 1;
      errorLineCount += e.rows.length;
    }
  }

  return {
    entries,
    cellErrors,
    okEntryCount,
    okLineCount,
    errorEntryCount,
    errorLineCount,
  };
}

/** Flatten the valid entries into the wire shape the import endpoint takes. */
export function toImportRows(entries: JournalCsvEntry[]) {
  return entries.flatMap((e) =>
    e.rows.map((r) => ({
      line: r.line,
      journal_date: normalizeCsvDate(r.journalDate) ?? r.journalDate,
      reference: r.reference,
      property: r.propertyName,
      account_code: r.accountCode,
      account_name: r.accountName,
      debit: r.debit,
      credit: r.credit,
      description: r.description,
      name: r.name,
      gst_code: normalizeGstCode(r.gstCode) ?? r.gstCode,
    })),
  );
}

/** Build a CSV of only the failing rows, so they can be fixed and re-uploaded. */
export function errorRowsCsv(validation: JournalCsvValidation): string {
  const quote = (v: string) =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const header = [...JOURNAL_CSV_HEADER, "Problem"];
  const lines = [header.map(quote).join(",")];

  for (const entry of validation.entries) {
    if (entry.issues.length === 0 && entry.balanced) continue;
    for (const row of entry.rows) {
      const problems = entry.issues
        .filter((i) => i.line === row.line || i.line === 0)
        .map((i) => i.reason)
        .join(" ");
      lines.push(
        [
          row.journalDate,
          row.propertyName,
          row.accountCode,
          row.accountName,
          row.debit,
          row.credit,
          row.description,
          row.name,
          row.gstCode,
          row.reference,
          problems || "Entry is out of balance.",
        ]
          .map(quote)
          .join(","),
      );
    }
  }
  return lines.join("\n");
}
