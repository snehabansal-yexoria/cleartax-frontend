/**
 * Balance Sheet — the contract between this UI and the backend.
 *
 * The backend endpoints below do not exist yet. Every loader first calls the
 * planned endpoint; when it is missing (404 / 501) the loader returns sample
 * data with `isSample: true`, and the page shows a "sample data" notice. Once
 * the backend ships the endpoint with this shape, real data shows up with no
 * UI change. Full write-up: docs/BALANCE_SHEET_CGT_UI_HANDOFF.md.
 *
 *   GET  /api/entities/{entityId}/balance-sheet?from=&to=&columns=&compare=
 *   GET  /api/entities/{entityId}/balance-sheet/export?…same…&format=csv|xlsx|pdf
 *   GET  /api/entities/{entityId}/opening-balance
 *   PUT  /api/entities/{entityId}/opening-balance
 */

export type BalanceSheetCompare = "none" | "py" | "pp";
export type BalanceSheetColumns = "total" | "month" | "quarter" | "year";

export type BalanceSheetQuery = {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD — the "as at" date
  columns: BalanceSheetColumns;
  compare: BalanceSheetCompare;
};

export type BalanceSheetLine = {
  code: string;
  name: string;
  amount: number;
  /** Present only when `compare` is not "none". */
  compareAmount?: number | null;
};

export type BalanceSheetSubgroup = { name: string; lines: BalanceSheetLine[] };
/** `name` null for a section with no group level (Equity). */
export type BalanceSheetGroup = { name: string | null; subgroups: BalanceSheetSubgroup[] };
export type BalanceSheetSection = {
  key: "assets" | "liabilities" | "equity";
  title: string;
  groups: BalanceSheetGroup[];
};

export type BalanceSheet = {
  entityName: string;
  asAt: string; // YYYY-MM-DD
  compareAsAt: string | null;
  sections: BalanceSheetSection[];
  isSample?: boolean;
};

export type OpeningBalance = {
  asAt: string; // YYYY-MM-DD
  /** Current Asset codes only (1010–1499). */
  lines: { code: string; amount: number }[];
};

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

/** True when the planned endpoint is simply not there yet. */
function isMissing(status: number) {
  return status === 404 || status === 405 || status === 501;
}

export function balanceSheetQueryString(q: BalanceSheetQuery) {
  const sp = new URLSearchParams();
  sp.set("from", q.from);
  sp.set("to", q.to);
  sp.set("columns", q.columns);
  sp.set("compare", q.compare);
  return sp.toString();
}

export async function loadBalanceSheet(
  token: string,
  entityId: string,
  q: BalanceSheetQuery,
  entityName: string,
  signal?: AbortSignal,
): Promise<BalanceSheet> {
  try {
    const res = await fetch(
      `/api/entities/${encodeURIComponent(entityId)}/balance-sheet?${balanceSheetQueryString(q)}`,
      { headers: authHeaders(token), signal },
    );
    if (res.ok) {
      const data = (await res.json()) as BalanceSheet;
      if (data && Array.isArray(data.sections)) return data;
    } else if (!isMissing(res.status)) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.message || body?.error || "Could not load the balance sheet.");
    }
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    if ((err as Error)?.message && !(err instanceof TypeError)) throw err;
  }
  return sampleBalanceSheet(q, entityName);
}

export async function loadOpeningBalance(
  token: string,
  entityId: string,
): Promise<{ value: OpeningBalance | null; isSample: boolean }> {
  try {
    const res = await fetch(
      `/api/entities/${encodeURIComponent(entityId)}/opening-balance`,
      { headers: authHeaders(token) },
    );
    if (res.ok) return { value: (await res.json()) as OpeningBalance, isSample: false };
  } catch {
    // fall through to "none yet"
  }
  return { value: null, isSample: true };
}

export async function saveOpeningBalance(
  token: string,
  entityId: string,
  value: OpeningBalance,
): Promise<{ saved: boolean; isSample: boolean }> {
  try {
    const res = await fetch(
      `/api/entities/${encodeURIComponent(entityId)}/opening-balance`,
      {
        method: "PUT",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify(value),
      },
    );
    if (res.ok) return { saved: true, isSample: false };
    if (!isMissing(res.status)) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.message || body?.error || "Could not save the opening balance.");
    }
  } catch (err) {
    if (!(err instanceof TypeError)) throw err;
  }
  // Endpoint not built yet: keep it on this screen only.
  return { saved: false, isSample: true };
}

export async function exportBalanceSheet(
  token: string,
  entityId: string,
  q: BalanceSheetQuery,
  format: "csv" | "xlsx" | "pdf",
): Promise<Blob | null> {
  const res = await fetch(
    `/api/entities/${encodeURIComponent(entityId)}/balance-sheet/export?${balanceSheetQueryString(q)}&format=${format}`,
    { headers: authHeaders(token) },
  );
  if (res.ok) return res.blob();
  if (isMissing(res.status)) return null;
  const body = await res.json().catch(() => ({}));
  throw new Error(body?.message || body?.error || "The export failed.");
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** A balance sheet as CSV, built from what is on screen (used until the export endpoint exists). */
export function balanceSheetToCsv(sheet: BalanceSheet, showCompare: boolean) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const out: string[] = [];
  const head = ["Account code", "Account name", sheet.asAt];
  if (showCompare && sheet.compareAsAt) head.push(sheet.compareAsAt);
  out.push(head.map(esc).join(","));
  for (const s of sheet.sections) {
    out.push(esc(s.title));
    for (const g of s.groups) {
      if (g.name) out.push(esc(g.name));
      for (const sg of g.subgroups) {
        out.push(esc(sg.name));
        for (const l of sg.lines) {
          const row = [l.code, l.name, l.amount.toFixed(2)];
          if (showCompare && sheet.compareAsAt) row.push(l.compareAmount == null ? "" : l.compareAmount.toFixed(2));
          out.push(row.map(esc).join(","));
        }
      }
    }
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Sample data (only while the backend endpoint is missing)
// ---------------------------------------------------------------------------

function previousYearEnd(asAt: string) {
  const [y, m, d] = asAt.split("-").map(Number);
  return `${y - 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Last day of the quarter before the one `asAt` falls in. */
function previousQuarterEnd(asAt: string) {
  const [y, m] = asAt.split("-").map(Number);
  const qStartMonth = Math.floor((m - 1) / 3) * 3; // 0-based month the quarter starts in
  const end = new Date(Date.UTC(y, qStartMonth, 0)); // day 0 = last day of previous month
  return end.toISOString().slice(0, 10);
}

type SampleLine = [string, string, number, number];

export function sampleBalanceSheet(q: BalanceSheetQuery, entityName: string): BalanceSheet {
  const withCompare = q.compare !== "none";
  const L = (lines: SampleLine[]): BalanceSheetLine[] =>
    lines.map(([code, name, amount, prev]) => ({
      code,
      name,
      amount,
      ...(withCompare ? { compareAmount: prev } : {}),
    }));

  const sections: BalanceSheetSection[] = [
    {
      key: "assets",
      title: "Assets",
      groups: [
        {
          name: "Current Assets",
          subgroups: [
            { name: "Cash and Bank", lines: L([["1010", "Operating Bank Account", 25000, 21400], ["1011", "Rental Receipts Bank Account", 8450, 6900]]) },
            { name: "Receivables", lines: L([["1021", "Rent Receivable", 3200, 2750]]) },
            { name: "Other Current Receivables", lines: L([["1030", "GST Receivable", 2000, 1650]]) },
            { name: "Prepayments", lines: L([["1040", "Prepaid Insurance", 1150, 1080]]) },
          ],
        },
        {
          name: "Non-Current Assets",
          subgroups: [
            {
              name: "Investment Property",
              lines: L([
                ["1510", "Investment Property – Land", 420000, 420000],
                ["1511", "Investment Property – Building", 360000, 360000],
                ["1515", "Investment Property – Capitalised Acquisition Costs", 28500, 28500],
                ["1520", "Accumulated Depreciation – Building", -24000, -16000],
              ]),
            },
            {
              name: "Plant and Equipment",
              lines: L([
                ["1530", "Plant and Equipment", 18000, 18000],
                ["1537", "Accumulated Depreciation – Plant and Equipment", -6400, -3600],
              ]),
            },
            { name: "Loans and Investments", lines: L([["1554", "Long-Term Security Deposits", 2000, 2000]]) },
          ],
        },
      ],
    },
    {
      key: "liabilities",
      title: "Liabilities",
      groups: [
        {
          name: "Current Liabilities",
          subgroups: [
            { name: "Trade Payables", lines: L([["2010", "Accounts Payable – Suppliers", 4300, 3900], ["2011", "Property Management Fees Payable", 650, 600]]) },
            { name: "Accruals", lines: L([["2020", "Accrued Interest Payable", 1850, 1720]]) },
            { name: "Rental and Tenant Balances", lines: L([["2031", "Tenant Security Deposits / Bonds Held", 2400, 2400]]) },
            { name: "GST and Tax", lines: L([["2040", "GST Payable", 1600, 1380]]) },
            { name: "Current Borrowings", lines: L([["2050", "Property Loan – Current Portion", 12000, 12000]]) },
          ],
        },
        {
          name: "Non-Current Liabilities",
          subgroups: [
            {
              name: "Property Borrowings",
              lines: L([
                ["2510", "Property Loan – Non-Current", 486000, 498000],
                ["2513", "Loan from Trustee – Non-Current", 25000, 25000],
              ]),
            },
          ],
        },
      ],
    },
    {
      key: "equity",
      title: "Equity",
      groups: [
        {
          name: null,
          subgroups: [
            { name: "Trust Capital", lines: L([["3010", "Settled Sum / Trust Corpus", 100, 100], ["3011", "Additional Capital Contributions", 180000, 180000]]) },
            // previous-year current profit is set below so the comparison balances
            { name: "Accumulated Funds", lines: L([["3020", "Accumulated Profits", 83500, 43000], ["3022", "Current Year Profit / Loss", 40500, 0]]) },
          ],
        },
      ],
    },
  ];

  if (withCompare) {
    const sum = (s: BalanceSheetSection) =>
      s.groups.reduce((a, g) => a + g.subgroups.reduce((b, sg) => b + sg.lines.reduce((c, l) => c + (l.compareAmount ?? 0), 0), 0), 0);
    const plug = sum(sections[0]) - sum(sections[1]) - sum(sections[2]);
    const profit = sections[2].groups[0].subgroups[1].lines[1];
    profit.compareAmount = plug;
  }

  return {
    entityName,
    asAt: q.to,
    compareAsAt: q.compare === "py" ? previousYearEnd(q.to) : q.compare === "pp" ? previousQuarterEnd(q.to) : null,
    sections,
    isSample: true,
  };
}
