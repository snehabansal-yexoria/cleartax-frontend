"use client";

/**
 * The Mark as paid overlay for an upcoming payment: How was it paid? → Add a
 * new transaction / Select an existing transaction (with search), and Dismiss.
 * The same overlay clients had; it now opens from the accountant's pages, and
 * `clientName` (when given) makes its wording name whose transactions it means.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addPaymentTransaction,
  aud,
  dismissReminder,
  displayDate,
  loadPaymentCandidates,
  markReminderPaid,
  todayIso,
  type PaymentCandidate,
  type UpcomingPayment,
} from "./upcomingPaymentsApi";
import "./upcoming-payments.css";

export type Mode = "choose" | "select" | "add" | "dismiss";
export type Tone = "red" | "amb" | "";

export function plural(n: number, w: string) {
  return `${n} ${w}${n === 1 ? "" : "s"}`;
}

/** Overdue and 0–3 days red, 4–15 amber, later grey. */
export function tone(days: number): { tone: Tone; chip: string } {
  if (days < 0) return { tone: "red", chip: `Overdue by ${plural(-days, "day")}` };
  if (days === 0) return { tone: "red", chip: "Due today" };
  if (days <= 3) return { tone: "red", chip: `${plural(days, "day")} left` };
  if (days <= 15) return { tone: "amb", chip: `${plural(days, "day")} left` };
  return { tone: "", chip: `In ${days} days` };
}

export const Icon = {
  calendar: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  clock: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  check: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  ),
  x: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  plus: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  link: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </svg>
  ),
  chev: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  back: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  ),
  trash: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  ),
  warn: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5M12 18h.01" />
    </svg>
  ),
};

export function PaySheet({
  token,
  item,
  mode,
  phone,
  addTransactionHref,
  onMode,
  onClose,
  onDone,
  clientName,
}: {
  clientName?: string;
  token: string;
  item: UpcomingPayment & { days: number };
  mode: Mode;
  phone: boolean;
  addTransactionHref: string;
  onMode: (m: Mode) => void;
  onClose: () => void;
  onDone: (toast: string) => void;
}) {
  // Whose transactions the overlay talks about: "your" for the owner, the
  // client's name when an accountant opens it.
  const whose = clientName ? `${clientName}’s` : "your";
  const Whose = clientName ? `${clientName}’s` : "Your";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<PaymentCandidate[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [form, setForm] = useState({ date: todayIso(), amount: item.amount.toFixed(2), description: item.alertName });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    setError("");
  }, [mode]);

  // Candidates load when the list opens and again (debounced) as the search changes.
  useEffect(() => {
    if (mode !== "select") return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const list = await loadPaymentCandidates(token, item, search);
        if (!cancelled) setCandidates(list);
      } catch (err) {
        if (!cancelled) {
          setCandidates([]);
          setError((err as Error)?.message || `Could not load ${whose} transactions.`);
        }
      }
    }, search ? 300 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, search, token, item.id]);

  const sorted = useMemo(() => {
    const list = candidates ?? [];
    const same = (c: PaymentCandidate) => Math.abs(c.amount - item.amount) < 0.005;
    return [...list.filter(same), ...list.filter((c) => !same(c))].map((c) => ({ ...c, suggested: same(c) }));
  }, [candidates, item.amount]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError((err as Error)?.message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<Mode, string> = {
    choose: "Mark as paid",
    select: "Select the payment",
    add: "Add the payment",
    dismiss: "Remove this alert?",
  };
  const property = item.propertyNames.join(", ") || "—";
  const amountNum = Number.parseFloat(form.amount.replace(/[^0-9.]/g, ""));
  const pickedRow = sorted.find((c) => c.id === picked);

  return (
    <div className={`upd-scrim${phone ? " upd-scrim--phone" : ""}`} onClick={onClose}>
      <div
        className="upd-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upd-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="upd-sh-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 id="upd-sheet-title">{titles[mode]}</h3>
            <p>{clientName ? `${clientName} · ${item.alertName}` : item.alertName}</p>
          </div>
          <button type="button" className="upd-ibtn" aria-label="Close" onClick={onClose}>
            {Icon.x}
          </button>
        </div>
        <div className="upd-sum">
          <div>
            Amount<b>{aud(item.amount)}</b>
          </div>
          <div>
            Due date<b>{displayDate(item.dueDate)}</b>
          </div>
          <div>
            Property<b>{property}</b>
          </div>
        </div>

        {mode === "choose" && (
          <>
            <div className="upd-sh-body">
              <div className="upd-q">How was it paid?</div>
              <button type="button" className="upd-opt" onClick={() => onMode("add")}>
                <span className="upd-oi">{Icon.plus}</span>
                <span>
                  <b>Add a new transaction</b>
                  <span>Record the payment now. We fill in the amount, category and property for you.</span>
                </span>
                <span className="upd-chev">{Icon.chev}</span>
              </button>
              <button type="button" className="upd-opt" onClick={() => onMode("select")}>
                <span className="upd-oi">{Icon.link}</span>
                <span>
                  <b>Select an existing transaction</b>
                  <span>Already recorded it, or it came in from the bank? Pick it from {whose} transactions.</span>
                </span>
                <span className="upd-chev">{Icon.chev}</span>
              </button>
            </div>
            <div className="upd-sh-foot">
              <button type="button" className="upd-btn dtext" onClick={() => onMode("dismiss")}>
                {Icon.trash}
                Dismiss alert
              </button>
              <span className="sp" />
              <button type="button" className="upd-btn" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}

        {mode === "select" && (
          <>
            <div className="upd-sh-body">
              <button type="button" className="upd-back" onClick={() => onMode("choose")}>
                {Icon.back}
                Back
              </button>
              <label className="upd-search">
                {Icon.search}
                <input
                  aria-label="Search transactions"
                  placeholder="Search by description or amount"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <div className="upd-hint-sm">{Whose} transactions, newest first</div>
              <div className="upd-txl" role="radiogroup" aria-label="Transactions">
                {candidates === null ? (
                  <div className="upd-none">Loading {whose} transactions…</div>
                ) : sorted.length === 0 ? (
                  <div className="upd-none">No transactions found.</div>
                ) : (
                  sorted.map((c) => (
                    <label key={c.id} className={`upd-tx${picked === c.id ? " on" : ""}`}>
                      <input type="radio" name="upd-tx" checked={picked === c.id} onChange={() => setPicked(c.id)} />
                      <span style={{ minWidth: 0 }}>
                        <span className="upd-td">
                          {c.description}
                          {c.suggested && <span className="upd-sug">Suggested · same amount</span>}
                        </span>
                        <span className="upd-tm">
                          {[c.date ? displayDate(c.date) : "", c.propertyNames.join(", "), c.source ? c.source[0].toUpperCase() + c.source.slice(1).replace(/_/g, " ") : ""]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="upd-ta">{aud(c.amount)}</span>
                    </label>
                  ))
                )}
              </div>
              {error && <div className="upd-err">{error}</div>}
            </div>
            <div className="upd-sh-foot">
              <button type="button" className="upd-btn dtext" onClick={() => onMode("dismiss")}>
                {Icon.trash}
                Dismiss alert
              </button>
              <span className="sp" />
              <button type="button" className="upd-btn" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="upd-btn pri"
                disabled={!picked || busy}
                onClick={() =>
                  void run(async () => {
                    await markReminderPaid(token, item.id, picked as string);
                    onDone(`Marked as paid · linked to “${pickedRow?.description ?? "transaction"}”`);
                  })
                }
              >
                {busy ? "Saving…" : "Mark as paid"}
              </button>
            </div>
          </>
        )}

        {mode === "add" && (
          <>
            <div className="upd-sh-body">
              <button type="button" className="upd-back" onClick={() => onMode("choose")}>
                {Icon.back}
                Back
              </button>
              <div className="upd-form">
                <label className="upd-fld">
                  Date paid
                  <input
                    type="date"
                    value={form.date}
                    max={todayIso()}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </label>
                <label className="upd-fld">
                  Amount (A$)
                  <input
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                </label>
                <div className="upd-fld">
                  Category
                  <div className="upd-ro">{[item.categoryName, item.subcategoryName].filter(Boolean).join(" › ") || "—"}</div>
                </div>
                <div className="upd-fld">
                  Property
                  <div className="upd-ro">{property}</div>
                </div>
                <label className="upd-fld wide">
                  Description
                  <input
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </label>
              </div>
              <div className="upd-hint">
                Saved to {whose} transactions like any other, and this alert is cleared. Need a receipt or a GST split?{" "}
                <Link href={addTransactionHref}>Use the full Add transaction page</Link>.
              </div>
              {error && <div className="upd-err">{error}</div>}
            </div>
            <div className="upd-sh-foot">
              <span className="sp" />
              <button type="button" className="upd-btn" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="upd-btn pri"
                disabled={busy || !form.date || !(amountNum > 0)}
                onClick={() =>
                  void run(async () => {
                    const newId = await addPaymentTransaction(token, item, {
                      date: form.date,
                      amount: amountNum,
                      description: form.description,
                    });
                    await markReminderPaid(token, item.id, newId);
                    onDone("Transaction saved · alert cleared");
                  })
                }
              >
                {busy ? "Saving…" : "Save & mark as paid"}
              </button>
            </div>
          </>
        )}

        {mode === "dismiss" && (
          <>
            <div className="upd-sh-body">
              <div className="upd-warn">
                <span className="upd-wi">{Icon.warn}</span>
                <span>
                  The alert for <b>{item.alertName}</b> will be removed from Upcoming payments. It is not marked as
                  paid, and no transaction is changed.
                </span>
              </div>
              {error && <div className="upd-err">{error}</div>}
            </div>
            <div className="upd-sh-foot">
              <span className="sp" />
              <button type="button" className="upd-btn" onClick={onClose}>
                Keep alert
              </button>
              <button
                type="button"
                className="upd-btn danger"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await dismissReminder(token, item.id);
                    onDone("Alert removed");
                  })
                }
              >
                {busy ? "Removing…" : "Remove alert"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
