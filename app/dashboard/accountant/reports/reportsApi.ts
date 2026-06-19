"use client";

// Client-side data layer for the accountant Reports UI. Pages call these
// fetchers, which attach the Cognito id token and hit the Next route handlers
// under /api/reports/*, which in turn proxy to the core API.

import { getSession } from "@/src/lib/session";
import type {
  ReportClient,
  ReportDocument,
  ReportEntity,
  ReportProperty,
  ReportRule,
  ReportSummary,
  ReportTimelineEvent,
  ReportTransaction,
} from "@/src/lib/coreApi";

export type {
  ReportClient,
  ReportDocument,
  ReportEntity,
  ReportProperty,
  ReportRule,
  ReportSummary,
  ReportTimelineEvent,
  ReportTransaction,
};

// Options carried by the dashboard's custom date-range picker.
export type PeriodOptions = { from?: string; to?: string; clientId?: string };

// Maps the UI's period button labels to the backend's period values.
function toApiPeriod(label: string): string {
  switch (label) {
    case "Today":
      return "today";
    case "7 days":
      return "7days";
    case "30 days":
      return "30days";
    case "3 months":
      return "3months";
    default:
      return "30days";
  }
}

// Builds the query string. For the "custom" period the from/to dates are sent
// instead of a period keyword.
function buildQuery(period: string, opts: PeriodOptions = {}): string {
  const sp = new URLSearchParams();
  if (period === "custom" && opts.from && opts.to) {
    sp.set("from", opts.from);
    sp.set("to", opts.to);
  } else {
    sp.set("period", toApiPeriod(period));
  }
  if (opts.clientId) sp.set("clientId", opts.clientId);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function authHeaders(): Promise<Record<string, string>> {
  const session = await getSession();
  const token = session?.getIdToken().getJwtToken();
  if (!token) {
    throw new Error("Not authenticated");
  }
  return { Authorization: `Bearer ${token}` };
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: await authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // non-JSON error body — keep the status message
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

export function fetchReportSummary(period: string, opts?: PeriodOptions) {
  return getJSON<ReportSummary>(`/api/reports/summary${buildQuery(period, opts)}`);
}

export function fetchReportTimeline(period: string, opts?: PeriodOptions) {
  return getJSON<ReportTimelineEvent[]>(
    `/api/reports/timeline${buildQuery(period, opts)}`,
  );
}

export function fetchReportClients(period: string, opts?: PeriodOptions) {
  return getJSON<ReportClient[]>(`/api/reports/clients${buildQuery(period, opts)}`);
}

export function fetchReportClient(
  clientId: string,
  period: string,
  opts?: PeriodOptions,
) {
  return getJSON<ReportClient>(
    `/api/reports/clients/${encodeURIComponent(clientId)}${buildQuery(period, opts)}`,
  );
}

export function fetchReportTransactions(period: string, opts?: PeriodOptions) {
  return getJSON<ReportTransaction[]>(
    `/api/reports/transactions${buildQuery(period, opts)}`,
  );
}

export function fetchReportProperties(period: string, opts?: PeriodOptions) {
  return getJSON<ReportProperty[]>(
    `/api/reports/properties${buildQuery(period, opts)}`,
  );
}

export function fetchReportEntities(period: string, opts?: PeriodOptions) {
  return getJSON<ReportEntity[]>(
    `/api/reports/entities${buildQuery(period, opts)}`,
  );
}

export function fetchReportDocuments(period: string, opts?: PeriodOptions) {
  return getJSON<ReportDocument[]>(
    `/api/reports/documents${buildQuery(period, opts)}`,
  );
}

export function fetchReportRules(period: string, opts?: PeriodOptions) {
  return getJSON<ReportRule[]>(`/api/reports/rules${buildQuery(period, opts)}`);
}
