/**
 * Balance Sheet — the browser's calls to the BFF.
 *
 *   GET  /api/entities/{entityId}/balance-sheet?from=&to=&compare=
 *   GET  /api/entities/{entityId}/balance-sheet/export?…same…&format=csv|xlsx|pdf
 *   GET  /api/entities/{entityId}/opening-balance
 *   PUT  /api/entities/{entityId}/opening-balance
 *
 * A failed call is always shown as a failure. Nothing here falls back to
 * example figures: on a financial report those read as the real position.
 */

export type BalanceSheetCompare = "none" | "py" | "pp";

export type BalanceSheetQuery = {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD — the "as at" date
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
  /** Balance sheet transactions left out: their typed category names no account. */
  unmappedCount: number;
};

export type OpeningBalance = {
  asAt: string; // YYYY-MM-DD
  /** Current Asset codes only (1010–1499). */
  lines: { code: string; amount: number }[];
};

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function errorMessage(res: Response, fallback: string) {
  const body = await res.json().catch(() => ({}));
  return body?.message || body?.error || fallback;
}

export function balanceSheetQueryString(q: BalanceSheetQuery) {
  const sp = new URLSearchParams();
  sp.set("from", q.from);
  sp.set("to", q.to);
  sp.set("compare", q.compare);
  return sp.toString();
}

export async function loadBalanceSheet(
  token: string,
  entityId: string,
  q: BalanceSheetQuery,
  signal?: AbortSignal,
): Promise<BalanceSheet> {
  const res = await fetch(
    `/api/entities/${encodeURIComponent(entityId)}/balance-sheet?${balanceSheetQueryString(q)}`,
    { headers: authHeaders(token), signal },
  );
  if (!res.ok) throw new Error(await errorMessage(res, "Could not load the balance sheet."));
  return (await res.json()) as BalanceSheet;
}

/** Null when none has been entered yet, which the API reports as a 404. */
export async function loadOpeningBalance(
  token: string,
  entityId: string,
): Promise<OpeningBalance | null> {
  const res = await fetch(
    `/api/entities/${encodeURIComponent(entityId)}/opening-balance`,
    { headers: authHeaders(token) },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await errorMessage(res, "Could not load the opening balance."));
  return (await res.json()) as OpeningBalance;
}

export async function saveOpeningBalance(
  token: string,
  entityId: string,
  value: OpeningBalance,
): Promise<OpeningBalance> {
  const res = await fetch(
    `/api/entities/${encodeURIComponent(entityId)}/opening-balance`,
    {
      method: "PUT",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(value),
    },
  );
  if (!res.ok) throw new Error(await errorMessage(res, "Could not save the opening balance."));
  return (await res.json()) as OpeningBalance;
}

export async function exportBalanceSheet(
  token: string,
  entityId: string,
  q: BalanceSheetQuery,
  format: "csv" | "xlsx" | "pdf",
): Promise<Blob> {
  const res = await fetch(
    `/api/entities/${encodeURIComponent(entityId)}/balance-sheet/export?${balanceSheetQueryString(q)}&format=${format}`,
    { headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(await errorMessage(res, "The export failed."));
  return res.blob();
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
