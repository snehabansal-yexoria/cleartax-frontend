"use client";

import type { CoreTransactionListItem } from "@/src/lib/coreApi";

/**
 * Where a transaction came from: `source` on each row and `?source=` on the list
 * endpoints. The API works it out (transactionSourceSQL). General is a General
 * Journal entry and Manual is anything entered or uploaded through Add
 * Transaction.
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

export function TransactionSourceBadge({ row }: { row: Pick<CoreTransactionListItem, "source"> }) {
  const src = TRANSACTION_SOURCES.find((s) => s.value === row.source);
  if (!src) return <span>—</span>;
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
