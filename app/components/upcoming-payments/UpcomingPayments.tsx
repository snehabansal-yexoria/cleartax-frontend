"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getIdToken } from "@/src/lib/authToken";
import {
  addPaymentTransaction,
  aud,
  daysUntil,
  dismissReminder,
  displayDate,
  loadPaymentCandidates,
  loadUpcomingPayments,
  markReminderPaid,
  reopenReminder,
  todayIso,
  type PaymentCandidate,
  type UpcomingPayment,
} from "./upcomingPaymentsApi";
import "./upcoming-payments.css";

type Mode = "choose" | "select" | "add" | "dismiss";
type Tone = "red" | "amb" | "";

function plural(n: number, w: string) {
  return `${n} ${w}${n === 1 ? "" : "s"}`;
}

/** Overdue and 0–3 days red, 4–15 amber, later grey. */
function tone(days: number): { tone: Tone; chip: string } {
  if (days < 0) return { tone: "red", chip: `Overdue by ${plural(-days, "day")}` };
  if (days === 0) return { tone: "red", chip: "Due today" };
  if (days <= 3) return { tone: "red", chip: `${plural(days, "day")} left` };
  if (days <= 15) return { tone: "amb", chip: `${plural(days, "day")} left` };
  return { tone: "", chip: `In ${days} days` };
}

const Icon = {
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

/**
 * Client dashboard → Upcoming payments. Regular payments the client set up
 * on Add Transaction, closest due date first, coloured within 15 days.
 * Mark as paid links a payment (new or existing) and clears the alert;
 * Dismiss clears it without a payment. Desktop/tablet: a short list that
 * scrolls inside the card. Phone: one card at a time, swiped sideways.
 */
export default function UpcomingPayments({
  variant = "desktop",
  addTransactionHref,
}: {
  variant?: "desktop" | "phone";
  addTransactionHref: string;
}) {
  const [token, setToken] = useState("");
  const [items, setItems] = useState<UpcomingPayment[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState<"all" | "15">("all");
  const [sheet, setSheet] = useState<{ id: string; mode: Mode } | null>(null);
  const [toast, setToast] = useState<{ text: string; item?: UpcomingPayment } | null>(null);

  const reload = useCallback(async (tk: string) => {
    try {
      setItems(await loadUpcomingPayments(tk));
      setLoadError("");
    } catch (err) {
      setLoadError((err as Error)?.message || "Could not load upcoming payments.");
      setItems([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tk = await getIdToken();
        if (cancelled) return;
        setToken(tk);
        await reload(tk);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 7000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const live = useMemo(
    () => (items ?? []).map((i) => ({ ...i, days: daysUntil(i.dueDate) })).sort((a, b) => a.days - b.days),
    [items],
  );
  const overdue = live.filter((i) => i.days < 0).length;
  const soon = live.filter((i) => i.days >= 0 && i.days <= 15).length;
  const urgent = live.some((i) => i.days <= 3);
  const shown = filter === "15" ? live.filter((i) => i.days <= 15) : live;
  const current = sheet ? live.find((i) => i.id === sheet.id) ?? null : null;

  const removeLocally = (id: string) => setItems((list) => (list ?? []).filter((i) => i.id !== id));

  const finish = (item: UpcomingPayment, text: string) => {
    removeLocally(item.id);
    setSheet(null);
    setToast({ text, item });
  };

  const undo = async () => {
    const item = toast?.item;
    setToast(null);
    if (!item) return;
    setItems((list) => [...(list ?? []).filter((i) => i.id !== item.id), item]);
    try {
      await reopenReminder(token, item.id);
    } catch {
      /* the list reloads from the server next visit */
    }
  };

  if (items === null) return null; // the dashboard's own skeleton covers the first paint

  if (live.length === 0) {
    return (
      <section className="upd upd--slim" aria-label="Upcoming payments">
        <span className="upd-slim-ic">{Icon.check}</span>
        <b>{loadError ? "Upcoming payments couldn’t load" : "No upcoming payments"}</b>
        <span className="upd-slim-sub">
          {loadError ? loadError : "Regular payments show here before they’re due."}
        </span>
        {loadError ? (
          <button type="button" className="upd-slim-link" onClick={() => void reload(token)}>
            Try again
          </button>
        ) : (
          <Link className="upd-slim-link" href={addTransactionHref}>
            Add transaction
          </Link>
        )}
      </section>
    );
  }

  return (
    <>
      <section className={`upd${variant === "phone" ? " upd--phone" : ""}`} aria-labelledby="upd-title">
        <div className="upd-head">
          <span className="upd-hic">{Icon.calendar}</span>
          <h3 className="upd-title" id="upd-title">
            Upcoming payments
          </h3>
          <div className="upd-counts">
            {overdue > 0 && <span className="upd-count">{overdue} overdue</span>}
            {soon > 0 && <span className={`upd-count${urgent ? "" : " amb"}`}>{soon} due within 15 days</span>}
          </div>
          {variant === "phone" ? (
            shown.length > 1 && <span className="upd-swipe">Swipe for {shown.length - 1} more</span>
          ) : (
            <div className="upd-tabs" role="group" aria-label="Show payments">
              <button type="button" className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>
                All ({live.length})
              </button>
              <button type="button" className={filter === "15" ? "on" : ""} onClick={() => setFilter("15")}>
                Within 15 days ({overdue + soon})
              </button>
            </div>
          )}
        </div>
        <div className="upd-list">
          {shown.map((i, n) => {
            const t = tone(i.days);
            const first = n === 0 && t.tone === "red";
            const meta = [i.propertyNames.join(", "), i.entityName].filter(Boolean).join(" · ");
            return (
              <div key={i.id} className={`upd-row ${t.tone}${first ? " first" : ""}`}>
                <span className="upd-ric">{Icon.clock}</span>
                <div className="upd-main">
                  <div className="upd-name">
                    <span>{i.alertName}</span>
                    {first && <span className="upd-next">Next due</span>}
                  </div>
                  <div className="upd-meta">{meta}</div>
                  <div className="upd-dl">
                    Due {displayDate(i.dueDate)} <span className="upd-chip">{t.chip}</span>
                  </div>
                </div>
                <div className="upd-due">{displayDate(i.dueDate)}</div>
                <span className="upd-chip upd-chip--col">{t.chip}</span>
                <div className="upd-amt">{aud(i.amount)}</div>
                <div className="upd-act">
                  <button type="button" className="upd-btn pri sm" onClick={() => setSheet({ id: i.id, mode: "choose" })}>
                    {Icon.check}
                    Mark as paid
                  </button>
                  <button
                    type="button"
                    className="upd-ibtn"
                    aria-label={`Dismiss alert: ${i.alertName}`}
                    title="Dismiss alert"
                    onClick={() => setSheet({ id: i.id, mode: "dismiss" })}
                  >
                    {Icon.x}
                  </button>
                </div>
              </div>
            );
          })}
          {shown.length === 0 && <div className="upd-none">Nothing due in the next 15 days.</div>}
        </div>
      </section>

      {sheet && current && (
        <PaySheet
          token={token}
          item={current}
          mode={sheet.mode}
          phone={variant === "phone"}
          addTransactionHref={addTransactionHref}
          onMode={(mode) => setSheet({ id: current.id, mode })}
          onClose={() => setSheet(null)}
          onDone={(text) => finish(current, text)}
        />
      )}

      {toast && (
        <div className={`upd-toast${variant === "phone" ? " upd-toast--phone" : ""}`} role="status">
          <span className="upd-toast-ok">{Icon.check}</span>
          <span>{toast.text}</span>
          {toast.item && (
            <button type="button" onClick={() => void undo()}>
              Undo
            </button>
          )}
        </div>
      )}
    </>
  );
}

function PaySheet({
  token,
  item,
  mode,
  phone,
  addTransactionHref,
  onMode,
  onClose,
  onDone,
}: {
  token: string;
  item: UpcomingPayment & { days: number };
  mode: Mode;
  phone: boolean;
  addTransactionHref: string;
  onMode: (m: Mode) => void;
  onClose: () => void;
  onDone: (toast: string) => void;
}) {
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
          setError((err as Error)?.message || "Could not load your transactions.");
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
            <p>{item.alertName}</p>
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
                  <span>Already recorded it, or it came in from your bank? Pick it from your transactions.</span>
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
              <div className="upd-hint-sm">Your transactions, newest first</div>
              <div className="upd-txl" role="radiogroup" aria-label="Transactions">
                {candidates === null ? (
                  <div className="upd-none">Loading your transactions…</div>
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
                Saved to your transactions like any other, and this alert is cleared. Need a receipt or a GST split?{" "}
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
