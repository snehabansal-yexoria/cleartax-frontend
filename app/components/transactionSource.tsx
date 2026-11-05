"use client";

import type { CoreTransactionListItem } from "@/src/lib/coreApi";

/**
 * Where a transaction came from. The backend is expected to return a `source`
 * field on each transaction and accept `?source=` on GET /api/transactions
 * (see docs/BALANCE_SHEET_CGT_UI_HANDOFF.md). Until it does, the badge is
 * worked out from what the row already carries.
 */
export type TransactionSource = "bank" | "general" | "property_cost_base" | "borrowing_cost" | "manual";

export const TRANSACTION_SOURCES: { value: TransactionSource; label: string; bg: string; fg: string; dot: string }[] = [
  { value: "bank", label: "Bank", bg: "#e8ebfa", fg: "#28336e", dot: "#28336e" },
  { value: "general", label: "General", bg: "#f1f5f9", fg: "#334155", dot: "#64748b" },
  { value: "property_cost_base", label: "Property Cost Base", bg: "#fff1dd", fg: "#9a4d00", dot: "#f97316" },
  { value: "borrowing_cost", label: "Borrowing Cost", bg: "#ecfdf3", fg: "#15803d", dot: "#22c55e" },
  { value: "manual", label: "Manual", bg: "#f5eeff", fg: "#6d28d9", dot: "#8b5cf6" },
];

export const TRANSACTION_SOURCE_OPTIONS = [
  { label: "All Sources", value: "all" },
  ...TRANSACTION_SOURCES.map((s) => ({ label: s.label, value: s.value })),
];

function isSource(v: unknown): v is TransactionSource {
  return typeof v === "string" && TRANSACTION_SOURCES.some((s) => s.value === v);
}

export function transactionSourceOf(row: CoreTransactionListItem): TransactionSource {
  const direct = (row as unknown as { source?: unknown }).source;
  if (isSource(direct)) return direct;
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  if (isSource(meta.source)) return meta.source;
  if (row.type === "cost_base") return "property_cost_base";
  if (/borrowing/i.test(row.categoryName ?? "")) return "borrowing_cost";
  if (meta.reconciliation_id || meta.bank_transaction_id || meta.bank_tx_index !== undefined) return "bank";
  if (meta.journal_entry_id || meta.manual === true) return "manual";
  return "general";
}

export function TransactionSourceBadge({ row }: { row: CoreTransactionListItem }) {
  const src = TRANSACTION_SOURCES.find((s) => s.value === transactionSourceOf(row)) ?? TRANSACTION_SOURCES[1];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        padding: "4px 10px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        background: src.bg,
        color: src.fg,
      }}
    >
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: src.dot }} />
      {src.label}
    </span>
  );
}
