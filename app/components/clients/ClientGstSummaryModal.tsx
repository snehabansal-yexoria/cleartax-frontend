"use client";

import { useEffect, useRef } from "react";
import type { CoreGstScopeLevel } from "@/src/lib/coreApi";
import { gstOutcomeLabel, type UseGstSummaryResult } from "@/app/components/useGstSummary";
import {
  personalCategoryLabel,
  type UsePersonalSummaryResult,
} from "@/app/components/usePersonalAndAssetTransactions";
import { formatClientCurrency } from "./CurrencyFormatter";

/**
 * The client portal's GST Summary in full: the BAS labels (G1, 1A, 1B, 9), the
 * outcome, and the period's private spending by category.
 *
 * A client variant rather than the accountant's GstSummaryModal, which is
 * hard-styled for the light accountant panel. It renders the card's hook state
 * instead of fetching its own, so the card and the dialog can never show
 * different periods.
 *
 * A native <dialog> opened with showModal(): focus is trapped, Escape closes,
 * the page behind is inert, and it sits above the phone's bottom nav.
 */

/** GST amounts to the cent, the way they are filed. */
export function gstMoney(value: number): string {
  return formatClientCurrency(value, { decimals: 2 });
}

const RECONCILIATION: Record<CoreGstScopeLevel, string> = {
  property:
    "This property's share of each bill. A bill split across properties counts only its share here.",
  entity:
    "Every bill of this entity at full value — the sum of its properties, plus anything not allocated to a property.",
  client: "Every entity you own at full value — the sum of your entities.",
};

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function exportCsv(scopeName: string, gst: UseGstSummaryResult, personal: UsePersonalSummaryResult) {
  const s = gst.summary;
  if (!s) return;
  const name = scopeName || "GST Summary";
  const lines = [
    `GST Summary - ${name}`,
    `${s.period.label} (${s.period.from} to ${s.period.to})`,
    "Accruals basis - dated by invoice date",
    "",
    "Code,Field,Amount",
    `G1,Total Sales,${s.g1TotalSales.toFixed(2)}`,
    `1A,GST on Sales,${s.gstOnSales.toFixed(2)}`,
    `1B,GST on Purchases,${s.gstOnPurchases.toFixed(2)}`,
    `9,Net GST,${s.netGst.toFixed(2)}`,
    "",
    `${csvField(gstOutcomeLabel(s.outcome))},,${s.amountDue.toFixed(2)}`,
  ];
  if (personal.summary) {
    lines.push(
      "",
      personal.summary.period ? "Personal spending (not in 1B)" : "Personal spending (all time; not in 1B)",
      "Category,Count,Gross",
      ...personal.summary.categories.map(
        (c) => `${csvField(personalCategoryLabel(c))},${c.count},${c.grossAmount.toFixed(2)}`,
      ),
      `Total,${personal.summary.count},${personal.summary.totalGross.toFixed(2)}`,
    );
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `GST_Summary_${name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type Props = {
  scopeName: string;
  gst: UseGstSummaryResult;
  personal: UsePersonalSummaryResult;
  onClose: () => void;
};

export default function ClientGstSummaryModal({ scopeName, gst, personal, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Mounted only while open: show on mount, and report any native close
  // (Escape, the form button) back to the card.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const handleClose = () => onCloseRef.current();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  const s = gst.summary;
  if (!s) return null;
  const level = s.scope.level;
  const outcomeTone =
    s.outcome === "payment_due" ? "is-bad" : s.outcome === "refund_due" ? "is-good" : "is-neutral";
  const p = personal.summary;

  const rows: { code: string; field: string; amount: number; note?: string }[] = [
    {
      code: "G1",
      field: "Total sales (GST incl.)",
      amount: s.g1TotalSales,
      note: `${gstMoney(s.salesNet)} net + ${gstMoney(s.gstOnSales)} GST · ${s.salesCount} sale${s.salesCount === 1 ? "" : "s"}`,
    },
    { code: "1A", field: "GST on sales", amount: s.gstOnSales },
    {
      code: "1B",
      field: "GST on purchases",
      amount: s.gstOnPurchases,
      note: `On ${gstMoney(s.purchasesTotal)} of purchases · ${s.purchasesCount} purchase${s.purchasesCount === 1 ? "" : "s"}`,
    },
    { code: "9", field: "Net GST (1A − 1B)", amount: s.amountDue, note: gstOutcomeLabel(s.outcome) },
  ];

  return (
    <dialog
      ref={ref}
      className="client-gst-dialog"
      aria-labelledby="client-gst-dialog-title"
      // A click on the backdrop lands on the dialog element itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className="client-gst-dialog-body">
        <header className="flex items-start justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <h2 id="client-gst-dialog-title" className="text-lg font-bold text-[var(--text-primary)]">
              GST Summary
            </h2>
            <div className="text-[12px] text-[var(--text-secondary)] break-words">
              {[scopeName, s.period.label].filter(Boolean).join(" · ")}
              {s.period.from && ` (${s.period.from} to ${s.period.to})`}
            </div>
          </div>
          <form method="dialog">
            <button
              type="submit"
              aria-label="Close"
              className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-secondary)] cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </form>
        </header>

        {s.unreviewedCount != null && s.unreviewedCount > 0 && (
          <div className="mt-3">
            <span className="portfolio-pill is-warn is-lg">
              {s.unreviewedCount} awaiting review included
            </span>
          </div>
        )}

        <section className="mt-4" aria-labelledby="client-gst-bas">
          <h3 id="client-gst-bas" className="text-[13px] font-bold text-[var(--text-primary)] mb-2">
            BAS labels
          </h3>
          <table className="portfolio-table w-full text-[12px] tabular-nums">
            <thead>
              <tr>
                <th className="text-left w-12">Code</th>
                <th className="text-left">Field</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code}>
                  <td className="font-bold align-top">{r.code}</td>
                  <td className="align-top">
                    <div>{r.field}</div>
                    {r.note && <div className="text-[11px] text-[var(--text-muted)]">{r.note}</div>}
                  </td>
                  <td className="text-right align-top font-semibold">{gstMoney(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <span className={`portfolio-pill is-lg ${outcomeTone}`}>{gstOutcomeLabel(s.outcome)}</span>
            <strong className="text-lg tabular-nums text-[var(--text-primary)]">{gstMoney(s.amountDue)}</strong>
          </div>
        </section>

        <section className="mt-5" aria-labelledby="client-gst-personal">
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <h3 id="client-gst-personal" className="text-[13px] font-bold text-[var(--text-primary)]">
              Personal transactions
            </h3>
            <span className="text-[11px] text-[var(--text-muted)]">
              {p && !p.period ? "All time · not in 1B" : "Not in 1B"}
            </span>
          </div>
          {personal.error ? (
            <div className="text-[12px] text-[var(--danger)] font-semibold">{personal.error}</div>
          ) : !p ? (
            <div className="h-16 rounded-xl bg-[var(--surface-2)] animate-pulse" aria-busy="true" />
          ) : p.categories.length === 0 ? (
            <div className="text-[12px] text-[var(--text-secondary)]">No personal spending in this period.</div>
          ) : (
            <table className="portfolio-table w-full text-[12px] tabular-nums">
              <thead>
                <tr>
                  <th className="text-left">Category</th>
                  <th className="text-right">Items</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {p.categories.map((c) => (
                  <tr key={`${c.categoryId}:${c.subcategoryName}`}>
                    <td>{personalCategoryLabel(c)}</td>
                    <td className="text-right">{c.count}</td>
                    <td className="text-right">{gstMoney(c.grossAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="text-right">{p.count}</td>
                  <td className="text-right">{gstMoney(p.totalGross)}</td>
                </tr>
              </tfoot>
            </table>
          )}
          <div className="mt-2 text-[11px] text-[var(--text-muted)] leading-relaxed">
            Private spending is not a creditable purchase, so it is left out of GST on purchases. The private part of
            a part-business bill is counted here and only the business part in 1B.
          </div>
        </section>

        <footer className="mt-5 flex flex-col gap-3">
          <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">
            {RECONCILIATION[level]} Accruals basis — dated by invoice date. Excludes bills awaiting review and
            rejected ones.
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => exportCsv(scopeName, gst, personal)}
              className="text-xs font-bold text-[var(--text-primary)] border border-[var(--border)] px-3.5 py-2 rounded-lg cursor-pointer"
            >
              Export CSV
            </button>
            <form method="dialog">
              <button
                type="submit"
                className="text-xs font-bold text-white bg-[var(--brand)] px-3.5 py-2 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </form>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
