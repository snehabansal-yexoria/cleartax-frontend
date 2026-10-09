import type { ClientRecord, InvitedUser, OrgProperty, OrgStatement, OrgTransaction, Portfolio } from "./adminData";
import { formatMonth } from "./format";

/* --------------------------------------------------------------- periods */

export type PeriodId = "fy-current" | "fy-previous" | "last-12" | "quarter" | "month" | "all";

export type Period = { id: PeriodId; label: string; from: Date | null; to: Date | null };

function financialYearStart(date: Date) {
  const year = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
  return new Date(year, 6, 1);
}

function fyLabel(start: Date) {
  const y = start.getFullYear();
  return `FY ${y}–${String(y + 1).slice(2)}`;
}

export function getPeriods(now = new Date()): Period[] {
  const fyStart = financialYearStart(now);
  const prevStart = new Date(fyStart.getFullYear() - 1, 6, 1);
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  return [
    { id: "fy-current", label: `${fyLabel(fyStart)} (to date)`, from: fyStart, to: null },
    { id: "fy-previous", label: fyLabel(prevStart), from: prevStart, to: fyStart },
    { id: "last-12", label: "Last 12 months", from: new Date(now.getFullYear() - 1, now.getMonth() + 1, 1), to: null },
    { id: "quarter", label: "This quarter", from: quarterStart, to: null },
    { id: "month", label: "This month", from: new Date(now.getFullYear(), now.getMonth(), 1), to: null },
    { id: "all", label: "All time", from: null, to: null },
  ];
}

export function findPeriod(id: string, periods = getPeriods()) {
  return periods.find((period) => period.id === id) ?? periods[0];
}

export function inPeriod(value: string | null | undefined, period: Period) {
  if (!period.from && !period.to) return true;
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  if (period.from && time < period.from.getTime()) return false;
  if (period.to && time >= period.to.getTime()) return false;
  return true;
}

/** Month buckets between the period start (or 12 months back) and now. */
export function monthBuckets(period: Period, now = new Date()) {
  const end = period.to ? new Date(period.to.getTime() - 1) : now;
  const start = period.from ?? new Date(end.getFullYear(), end.getMonth() - 11, 1);
  const buckets: { key: string; label: string }[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end && buckets.length < 24) {
    buckets.push({ key: `${cursor.getFullYear()}-${cursor.getMonth()}`, label: formatMonth(cursor) });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

export function monthKey(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}-${date.getMonth()}`;
}

/* -------------------------------------------------------------- rollups */

export type Rollup = {
  clients: number;
  entities: number;
  properties: number;
  marketValue: number;
  loans: number;
  equity: number;
  transactions: number;
  reviewed: number;
  statements: number;
  statementsDone: number;
};

const ZERO: Rollup = {
  clients: 0,
  entities: 0,
  properties: 0,
  marketValue: 0,
  loans: 0,
  equity: 0,
  transactions: 0,
  reviewed: 0,
  statements: 0,
  statementsDone: 0,
};

export function rollupFor(
  clientIds: Set<string>,
  portfolio: Portfolio | undefined,
  transactions: OrgTransaction[] | undefined,
  period: Period,
): Rollup {
  const result = { ...ZERO, clients: clientIds.size };
  if (portfolio) {
    for (const entity of portfolio.entities) if (clientIds.has(entity.clientId)) result.entities += 1;
    for (const property of portfolio.properties) {
      if (!clientIds.has(property.clientId)) continue;
      result.properties += 1;
      result.marketValue += Number(property.estimatedMarketValue) || 0;
      result.loans += property.loanBalance;
      result.equity += property.equity;
    }
    for (const statement of portfolio.statements) {
      if (!clientIds.has(statement.clientId) || !inPeriod(statement.createdAt, period)) continue;
      result.statements += 1;
      if (isStatementDone(statement)) result.statementsDone += 1;
    }
  }
  if (transactions) {
    for (const txn of transactions) {
      if (!clientIds.has(txn.clientId) || !inPeriod(txn.invoiceDate, period)) continue;
      result.transactions += 1;
      if (txn.reviewStatus === "reviewed") result.reviewed += 1;
    }
  }
  return result;
}

export function isStatementDone(statement: OrgStatement) {
  return ["done", "completed", "complete", "reconciled"].includes(statement.status.toLowerCase());
}

export type AccountantStats = Rollup & {
  accountant: InvitedUser;
  clientIds: Set<string>;
};

export function clientsOf(accountant: InvitedUser, clients: ClientRecord[]) {
  return clients.filter((client) => client.assignedAccountantId === accountant.id);
}

export function accountantStats(
  accountants: InvitedUser[],
  clients: ClientRecord[],
  portfolio: Portfolio | undefined,
  transactions: OrgTransaction[] | undefined,
  period: Period,
): AccountantStats[] {
  return accountants.map((accountant) => {
    const clientIds = new Set(clientsOf(accountant, clients).map((client) => client.id));
    return { accountant, clientIds, ...rollupFor(clientIds, portfolio, transactions, period) };
  });
}

/* ------------------------------------------------------------ groupings */

export function countBy<T>(items: readonly T[], keyOf: (item: T) => string) {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item) || "Other";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export function sumBy<T>(items: readonly T[], keyOf: (item: T) => string, valueOf: (item: T) => number) {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item) || "Other";
    map.set(key, (map.get(key) ?? 0) + valueOf(item));
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export function propertiesPerClientBands(clients: ClientRecord[], properties: OrgProperty[]) {
  const counts = new Map<string, number>();
  for (const property of properties) counts.set(property.clientId, (counts.get(property.clientId) ?? 0) + 1);
  const bands: [string, (n: number) => boolean][] = [
    ["No properties", (n) => n === 0],
    ["1 property", (n) => n === 1],
    ["2 properties", (n) => n === 2],
    ["3–4", (n) => n >= 3 && n <= 4],
    ["5 or more", (n) => n >= 5],
  ];
  return bands.map(([label, test]) => [label, clients.filter((client) => test(counts.get(client.id) ?? 0)).length] as const);
}

export function equityBands(clients: ClientRecord[], properties: OrgProperty[]) {
  const equity = new Map<string, number>();
  for (const property of properties) equity.set(property.clientId, (equity.get(property.clientId) ?? 0) + property.equity);
  const bands: [string, (n: number) => boolean][] = [
    ["Under $250K", (n) => n < 250_000],
    ["$250K–$500K", (n) => n >= 250_000 && n < 500_000],
    ["$500K–$1M", (n) => n >= 500_000 && n < 1_000_000],
    ["Over $1M", (n) => n >= 1_000_000],
  ];
  return bands.map(([label, test]) => [label, clients.filter((client) => test(equity.get(client.id) ?? 0)).length] as const);
}

export function entityTypeLabel(type: string) {
  const labels: Record<string, string> = {
    individual: "Individual",
    trust: "Trust",
    smsf: "SMSF",
    company: "Company",
    partnership: "Partnership",
  };
  return labels[type] ?? (type ? type[0].toUpperCase() + type.slice(1) : "Other");
}
