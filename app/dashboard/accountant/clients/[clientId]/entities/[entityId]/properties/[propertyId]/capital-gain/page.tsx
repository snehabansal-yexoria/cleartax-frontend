"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getSession } from "@/src/lib/session";
import type { CoreCostBaseEntry, CoreGstRegistrationStatus, CoreProperty } from "@/src/lib/coreApi";
import {
  SELLING_COST_CATEGORY,
  SELLING_COST_SUBCATEGORIES,
  isSellingCostCategory,
  aud,
  displayDate,
  markPropertySold,
  parseMoney,
  saveSellingCosts,
  todayIso,
  type SellingCostRow,
} from "@/app/components/capital-gain/capitalGainApi";
import "@/app/components/balance-sheet/balance-sheet.css";

interface SessionWithIdToken {
  getIdToken(): { getJwtToken(): string };
}

type Step = 1 | 2 | 3 | 4;

type CostBaseLine = {
  id: string;
  category: string;
  description: string;
  gross: number;
  net: number;
  date: string | null;
};

let rowSeq = 0;
function newRow(date: string): SellingCostRow {
  rowSeq += 1;
  return { key: `r${rowSeq}`, subcategory: "", description: "", date, amount: "" };
}

export default function CapitalGainPage() {
  const params = useParams<{ clientId: string; entityId: string; propertyId: string }>();
  const router = useRouter();
  const { clientId = "", entityId = "", propertyId = "" } = params ?? {};
  const propertyHref = `/dashboard/accountant/clients/${clientId}/entities/${entityId}/properties/${propertyId}`;
  const today = useRef(todayIso()).current;

  const [token, setToken] = useState("");
  const [property, setProperty] = useState<CoreProperty | null>(null);
  const [entityName, setEntityName] = useState("");
  const [gstStatus, setGstStatus] = useState<CoreGstRegistrationStatus>("unknown");
  const [costBase, setCostBase] = useState<CostBaseLine[]>([]);
  // Selling costs already on the property, so answering "No" can clear them.
  const [savedSellingCostCount, setSavedSellingCostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [step, setStep] = useState<Step>(1);
  const [hasSellingCost, setHasSellingCost] = useState<boolean | null>(null);
  const [rows, setRows] = useState<SellingCostRow[]>(() => [newRow(today)]);
  const [sellingAmount, setSellingAmount] = useState("");
  const [soldDate, setSoldDate] = useState(today);
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "pdf" | "sold">("");
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) {
        router.replace("/login/user");
        return;
      }
      setToken(session.getIdToken().getJwtToken());
    })();
  }, [router]);

  useEffect(() => {
    if (!token || !propertyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [propRes, cbRes] = await Promise.all([
          fetch(`/api/properties/${encodeURIComponent(propertyId)}`, { headers }),
          fetch(`/api/properties/${encodeURIComponent(propertyId)}/cost-base`, { headers }),
        ]);
        if (cancelled) return;
        if (!propRes.ok) throw new Error("Could not load the property.");
        const prop = (await propRes.json()) as CoreProperty;
        setProperty(prop);
        if (prop.sellingAmount != null) setSellingAmount(String(prop.sellingAmount));
        if (prop.soldDate) setSoldDate(prop.soldDate);
        if (cbRes.ok) {
          const data = (await cbRes.json()) as { items?: CoreCostBaseEntry[] };
          const items = data.items ?? [];
          // Only Property Cost Base entries. Settlement entries live in a separate
          // list and are never part of this one. Selling costs come back into the
          // selling cost step, so returning from Add More does not lose them.
          setCostBase(
            items
              .filter((e) => !isSellingCostCategory(e.category))
              .map((e) => ({
                id: e.id,
                category: e.category,
                description: e.description ?? "",
                gross: e.grossAmount,
                net: e.netAmount,
                date: e.date,
              })),
          );
          const selling = items.filter((e) => isSellingCostCategory(e.category));
          setSavedSellingCostCount(selling.length);
          if (selling.length > 0) {
            setHasSellingCost(true);
            setRows(
              selling.map((e) => ({
                ...newRow(e.date ?? today),
                subcategory: e.subcategory ?? "",
                description: e.description ?? "",
                amount: String(e.grossAmount),
              })),
            );
          }
        } else {
          setLoadError("Could not load the Property Cost Base.");
        }
        const entRes = await fetch(`/api/entities/${encodeURIComponent(prop.entityId || entityId)}`, { headers });
        if (!cancelled && entRes.ok) {
          const ent = (await entRes.json()) as { name?: string; gstStatus?: CoreGstRegistrationStatus };
          setEntityName(ent?.name ?? "");
          setGstStatus(ent?.gstStatus ?? "unknown");
        }
      } catch (err) {
        if (!cancelled) setLoadError((err as Error)?.message ?? "Could not load the property.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, propertyId, entityId, today]);

  // A GST-registered entity claims the GST back, so it is not part of what the
  // property cost. An unknown status uses gross, and the screen and PDF say so.
  const usesNet = gstStatus === "registered";
  const amountOf = (l: CostBaseLine) => (usesNet ? l.net : l.gross);
  const gstBasisNote = usesNet
    ? "Amounts exclude GST because this entity is registered for GST."
    : gstStatus === "not_registered"
      ? "Amounts include GST because this entity is not registered for GST."
      : "Amounts include GST because this entity's GST registration is not recorded. Set it on the entity if it is registered.";
  const costBaseTotal = costBase.reduce((a, l) => a + amountOf(l), 0);
  const validRows = rows.filter((r) => r.subcategory || r.description || parseMoney(r.amount) !== 0);
  const sellingCostTotal = hasSellingCost ? validRows.reduce((a, r) => a + parseMoney(r.amount), 0) : 0;
  const futureRow = rows.some((r) => r.date > today);
  const sell = parseMoney(sellingAmount);
  const purchase = property?.purchaseAmount ?? 0;
  const net = sell - sellingCostTotal;
  const result = net - purchase - costBaseTotal;
  const isGain = result >= 0;
  const propertyName = property?.name || "Property";

  const setRow = (key: string, patch: Partial<SellingCostRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const continueFromSellingCosts = async () => {
    if (futureRow) return;
    setBusy("save");
    setNotice("");
    try {
      await saveSellingCosts(token, propertyId, validRows);
      setSavedSellingCostCount(validRows.length);
      setStep(4);
    } catch (err) {
      setNotice((err as Error)?.message ?? "Could not save the selling costs.");
    } finally {
      setBusy("");
    }
  };

  // "No" means zero, so rows saved on an earlier visit have to go as well.
  const continueWithoutSellingCosts = async () => {
    if (savedSellingCostCount === 0) {
      setStep(4);
      return;
    }
    setBusy("save");
    setNotice("");
    try {
      await saveSellingCosts(token, propertyId, []);
      setSavedSellingCostCount(0);
      setRows([newRow(today)]);
      setStep(4);
    } catch (err) {
      setNotice((err as Error)?.message ?? "Could not clear the selling costs.");
    } finally {
      setBusy("");
    }
  };

  const exportPdf = async () => {
    if (!pdfRef.current) return;
    setBusy("pdf");
    try {
      const { default: html2pdf } = await import("html2pdf.js");
      const worker = html2pdf();
      const options = {
        margin: [0, 0, 0, 0],
        filename: `ClearPortfolio_Capital-Gain_${propertyName.replace(/[^A-Za-z0-9]+/g, "-")}.pdf`,
        image: { type: "jpeg", quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      } as Parameters<typeof worker.set>[0];
      await worker.set(options).from(pdfRef.current).save();
    } catch {
      window.print();
    } finally {
      setBusy("");
    }
  };

  const markSold = async () => {
    setBusy("sold");
    setNotice("");
    try {
      await markPropertySold(token, propertyId, sell, soldDate);
      setProperty((prev) => (prev ? { ...prev, soldDate, sellingAmount: sell } : prev));
      setNotice("Property marked as sold.");
    } catch (err) {
      setNotice((err as Error)?.message ?? "Could not mark the property as sold.");
    } finally {
      setBusy("");
    }
  };

  const steps: { n: Step; label: string }[] = [
    { n: 1, label: "Cost base" },
    { n: 2, label: hasSellingCost === false && step === 4 ? "Selling cost (none)" : "Selling cost" },
    { n: 4, label: "Capital gain" },
  ];
  const stepClass = (n: Step) => {
    const effective = step === 3 ? 2 : step;
    const pos = n === 4 ? 3 : n;
    const cur = effective === 4 ? 3 : effective;
    return pos === cur ? "cg-step is-on" : pos < cur ? "cg-step is-done" : "cg-step";
  };

  const costBaseTable = (compact: boolean) => (
    <table className="cg-table">
      <thead>
        <tr>
          <th>Category</th>
          <th>Description</th>
          {compact ? <th>Date</th> : null}
          <th className="cg-num">Amount</th>
          {!compact ? <th style={{ width: 150 }}>Date</th> : null}
        </tr>
      </thead>
      <tbody>
        {costBase.map((l) => (
          <tr key={l.id}>
            <td style={{ fontWeight: 600 }}>{l.category || "—"}</td>
            <td>{l.description || "—"}</td>
            {compact ? <td>{displayDate(l.date)}</td> : null}
            <td className="cg-num">{aud(amountOf(l))}</td>
            {!compact ? <td>{displayDate(l.date)}</td> : null}
          </tr>
        ))}
        {costBase.length === 0 ? (
          <tr>
            <td colSpan={4} style={{ color: "#64748b", textAlign: "center", padding: 28 }}>
              No Property Cost Base entries yet. Use Add More to record them.
            </td>
          </tr>
        ) : null}
        <tr className="cg-total">
          <td colSpan={compact ? 3 : 2}>Total Property Cost Base</td>
          <td className="cg-num">{aud(costBaseTotal)}</td>
          {!compact ? <td /> : null}
        </tr>
      </tbody>
    </table>
  );

  return (
    <div className="journal-page cg-page">
      <Link href={propertyHref} className="entity-wizard-back">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {propertyName}
      </Link>

      <div className="cg-head">
        <div>
          <h1>Mark as Sold Out · Capital Gain</h1>
          <p>
            {propertyName}
            {entityName ? ` · ${entityName}` : ""}
          </p>
        </div>
        <div className="cg-steps" aria-label="Progress">
          {steps.map((s, i) => (
            <span key={s.n} style={{ display: "contents" }}>
              <span className={stepClass(s.n)}>
                <b>{stepClass(s.n).includes("is-done") ? "✓" : i + 1}</b>
                {s.label}
              </span>
              {i < steps.length - 1 ? <span className="cg-bar" /> : null}
            </span>
          ))}
        </div>
      </div>

      {loadError ? <div className="bs-notice is-sample">{loadError}</div> : null}
      {notice ? <div className="bs-notice">{notice}</div> : null}

      {loading ? (
        <div className="cg-card" style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
          Loading the property…
        </div>
      ) : null}

      {!loading && step === 1 ? (
        <section className="cg-card">
          <div className="cg-card-head">
            <div style={{ flex: 1 }}>
              <h2>Property Cost Base</h2>
              <p>All Property Cost Base transactions recorded for this property. Settlement entries are not included.</p>
            </div>
            <span style={{ fontSize: 13, color: "#64748b" }}>{costBase.length} transactions</span>
          </div>
          {costBaseTable(false)}
          <p style={{ margin: 0, padding: "12px 24px 0", fontSize: 13, color: "#64748b" }}>{gstBasisNote}</p>
          <div className="cg-actions">
            <span className="cg-hint">
              Missing something? <b>Add More</b> opens the property&apos;s P&amp;L view at the Property Cost Base. To
              come back, click Mark as Sold Out again.
            </span>
            <Link href={`${propertyHref}?view=pnl#property-cost-base`} className="bs-btn">
              + Add More
            </Link>
            <button type="button" className="bs-btn is-primary" onClick={() => setStep(2)}>
              Continue ›
            </button>
          </div>
        </section>
      ) : null}

      {!loading && step === 2 ? (
        <section className="cg-card" style={{ padding: 28 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Is there any selling cost?</h2>
          <p style={{ margin: "6px 0 22px", fontSize: 14, color: "#64748b" }}>
            For example agent commission, PEXA fees, advertising or professional fees paid to sell this property.
          </p>
          <div className="cg-choices" role="radiogroup" aria-label="Is there any selling cost?">
            <button
              type="button"
              role="radio"
              aria-checked={hasSellingCost === true}
              className={hasSellingCost === true ? "cg-choice is-on" : "cg-choice"}
              onClick={() => setHasSellingCost(true)}
            >
              <strong>Yes</strong>Add the selling costs in a table. They are saved to this property&apos;s cost base list.
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={hasSellingCost === false}
              className={hasSellingCost === false ? "cg-choice is-on" : "cg-choice"}
              onClick={() => setHasSellingCost(false)}
            >
              <strong>No</strong>Skip this step. Total selling cost will be A$ 0.00.
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 26 }}>
            <button type="button" className="bs-btn" onClick={() => setStep(1)}>
              ‹ Back
            </button>
            <button
              type="button"
              className="bs-btn is-primary"
              disabled={hasSellingCost === null || busy === "save"}
              onClick={() => (hasSellingCost ? setStep(3) : void continueWithoutSellingCosts())}
            >
              {busy === "save" ? "Saving…" : "Continue ›"}
            </button>
          </div>
        </section>
      ) : null}

      {!loading && step === 3 ? (
        <section className="cg-card" style={{ padding: "24px 26px" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Selling Costs</h2>
          <p style={{ margin: "6px 0 16px", fontSize: 13, color: "#475569" }}>
            Type straight into the cells, like a spreadsheet. Each row is saved to this property&apos;s Property Cost
            Base as a selling cost.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="cg-grid" style={{ minWidth: 880 }}>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th style={{ width: 120 }}>Category</th>
                  <th style={{ width: 240 }}>Subcategory</th>
                  <th>Description</th>
                  <th style={{ width: 180 }}>Date</th>
                  <th style={{ width: 160, textAlign: "right" }}>Amount (A$)</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const future = r.date > today;
                  return (
                    <tr key={r.key}>
                      <td style={{ color: "#94a3b8", fontSize: 13, paddingTop: 18 }}>{i + 1}</td>
                      <td style={{ fontSize: 13, fontWeight: 600, paddingTop: 18 }}>{SELLING_COST_CATEGORY}</td>
                      <td>
                        <select
                          className="cg-in"
                          aria-label="Subcategory"
                          value={r.subcategory}
                          onChange={(e) => setRow(r.key, { subcategory: e.target.value })}
                        >
                          <option value="">Choose…</option>
                          {SELLING_COST_SUBCATEGORIES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className="cg-in"
                          aria-label="Description"
                          placeholder="What was it for?"
                          value={r.description}
                          onChange={(e) => setRow(r.key, { description: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className={future ? "cg-in is-error" : "cg-in"}
                          type="date"
                          aria-label="Date"
                          max={today}
                          value={r.date}
                          onChange={(e) => setRow(r.key, { date: e.target.value })}
                        />
                        {future ? (
                          <div style={{ color: "#dc2626", fontSize: 12, fontWeight: 600, marginTop: 5 }}>
                            Can&apos;t be a future date
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <input
                          className="cg-in"
                          style={{ textAlign: "right" }}
                          inputMode="decimal"
                          aria-label="Amount"
                          placeholder="0.00"
                          value={r.amount}
                          onChange={(e) => setRow(r.key, { amount: e.target.value })}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="cg-del"
                          aria-label="Delete row"
                          onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((x) => x.key !== r.key) : [newRow(today)]))}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td />
                  <td colSpan={4} style={{ fontWeight: 700, fontSize: 14, paddingTop: 16 }}>
                    Total Selling Cost
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 800, fontSize: 15, paddingTop: 16 }}>
                    {aud(validRows.reduce((a, r) => a + parseMoney(r.amount), 0))}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="bs-btn" onClick={() => setRows((prev) => [...prev, newRow(today)])}>
              + Add Row
            </button>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              New rows start with today&apos;s date. Past dates and today are allowed; future dates are not.
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
            <button type="button" className="bs-btn" onClick={() => setStep(2)}>
              ‹ Back
            </button>
            <button
              type="button"
              className="bs-btn is-primary"
              disabled={futureRow || busy === "save"}
              onClick={() => void continueFromSellingCosts()}
            >
              {busy === "save" ? "Saving…" : "Continue ›"}
            </button>
          </div>
        </section>
      ) : null}

      {!loading && step === 4 ? (
        <div className="cg-calc-wrap">
          <section className="cg-card">
            <div style={{ padding: "22px 24px", borderBottom: "1px solid #eef1f6", display: "flex", gap: 18, alignItems: "flex-end", flexWrap: "wrap" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 700, color: "#28336e" }}>
                STEP 1 · TOTAL SELLING AMOUNT
                <span className="cg-money">
                  A$
                  <input
                    aria-label="Selling amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={sellingAmount}
                    onChange={(e) => setSellingAmount(e.target.value)}
                  />
                </span>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600, color: "#475569" }}>
                Sale date
                <input className="bs-date" style={{ height: 54 }} type="date" max={today} value={soldDate} onChange={(e) => setSoldDate(e.target.value)} />
              </label>
            </div>
            <div className="cg-sh">Step 2 · Net selling amount</div>
            <div className="cg-row">
              <span className="cg-op">A$</span>
              <span className="cg-label">Selling amount</span>
              <span className="cg-val">{aud(sell)}</span>
            </div>
            <div className="cg-row">
              <span className="cg-op">−</span>
              <span className="cg-label">
                Total selling cost{" "}
                <small>({hasSellingCost ? `${validRows.length} ${validRows.length === 1 ? "entry" : "entries"}` : "you chose No"})</small>
              </span>
              <span className="cg-val">{aud(sellingCostTotal)}</span>
            </div>
            <div className="cg-row is-strong">
              <span className="cg-op">=</span>
              <span className="cg-label" style={{ fontWeight: 700 }}>
                Net selling amount
              </span>
              <span className="cg-val">{aud(net)}</span>
            </div>
            <div className="cg-sh">Step 3 · Total property cost</div>
            <div className="cg-row">
              <span className="cg-op">−</span>
              <span className="cg-label">
                Purchase amount <small>(entered when the property was created)</small>
              </span>
              <span className="cg-val">{aud(purchase)}</span>
            </div>
            <div className="cg-row" style={{ borderBottom: 0 }}>
              <span className="cg-op">−</span>
              <span className="cg-label">
                Property cost base <small>(settlement entries not included)</small>
              </span>
              <button type="button" className="bs-btn" style={{ height: 32, fontSize: 12 }} onClick={() => setShowBreakdown((v) => !v)}>
                {showBreakdown ? "Hide breakdown ▴" : "Show breakdown ▾"}
              </button>
              <span className="cg-val">{aud(costBaseTotal)}</span>
            </div>
            {showBreakdown ? <div className="cg-breakdown">{costBaseTable(true)}</div> : null}
            <div style={{ borderTop: "1px solid #eef1f6", padding: "14px 24px", fontSize: 13, color: "#64748b" }}>
              Net selling amount − Purchase amount − Property cost base = Capital gain / loss
              <div style={{ marginTop: 6 }}>{gstBasisNote}</div>
            </div>
          </section>

          <aside className="cg-side">
            <section className={isGain ? "cg-result" : "cg-result is-loss"} aria-live="polite">
              <div className="cg-kind">{isGain ? "▲ Capital gain" : "▼ Capital loss"}</div>
              <div className="cg-amount">{aud(result)}</div>
              <p>
                {isGain
                  ? "Net selling amount is higher than the total property cost."
                  : "Total property cost is higher than the net selling amount."}
              </p>
            </section>
            <section className="cg-summary">
              <div>
                <span>Net selling amount</span>
                <b>{aud(net)}</b>
              </div>
              <div>
                <span>Purchase amount</span>
                <b>{aud(purchase)}</b>
              </div>
              <div>
                <span>Property cost base</span>
                <b>{aud(costBaseTotal)}</b>
              </div>
            </section>
            <button type="button" className="bs-btn is-primary" style={{ height: 48 }} disabled={busy === "pdf"} onClick={() => void exportPdf()}>
              {busy === "pdf" ? "Preparing PDF…" : "Export Capital Gain report (PDF)"}
            </button>
            <button type="button" className="bs-btn" disabled={busy === "sold" || sell <= 0} onClick={() => void markSold()}>
              {property?.soldDate ? "Update sale details" : "Mark property as sold"}
            </button>
            <button type="button" className="bs-btn" onClick={() => setStep(hasSellingCost ? 3 : 2)}>
              ‹ Back
            </button>
          </aside>
        </div>
      ) : null}

      {/* The PDF layout, kept off screen and captured on export. */}
      <div style={{ position: "fixed", left: -10000, top: 0 }} aria-hidden="true">
        <div ref={pdfRef} className="cg-pdf">
          <div className="cg-pdf-head">
            <div className="cg-pdf-logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#24316e" strokeWidth="2.2">
                <rect x="5" y="5" width="6" height="6" rx="1.2" />
                <rect x="13" y="5" width="6" height="6" rx="1.2" />
                <rect x="5" y="13" width="6" height="6" rx="1.2" />
                <rect x="13" y="13" width="6" height="6" rx="1.2" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>Capital Gain Report</div>
              <div style={{ fontSize: 11, color: "#6b7393" }}>Prepared with ClearPortfolio · {displayDate(today)}</div>
            </div>
            <div style={{ textAlign: "right", fontSize: 11, color: "#6b7393" }}>{entityName}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px 28px", fontSize: 12 }}>
            <div>
              <div style={{ color: "#6b7393", fontWeight: 600 }}>Property</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{propertyName}</div>
              <div style={{ color: "#4c5375" }}>{property?.locationText ?? ""}</div>
            </div>
            <div>
              <div style={{ color: "#6b7393", fontWeight: 600 }}>Owner (entity)</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{entityName || "—"}</div>
            </div>
            <div>
              <div style={{ color: "#6b7393", fontWeight: 600 }}>Purchased</div>
              <div style={{ fontWeight: 600 }}>{displayDate(property?.purchaseDate)}</div>
            </div>
            <div>
              <div style={{ color: "#6b7393", fontWeight: 600 }}>Sold</div>
              <div style={{ fontWeight: 600 }}>{displayDate(soldDate)}</div>
            </div>
          </div>
          <div>
            <h3>Calculation</h3>
            <table className="cg-pdf-rows">
              <tbody>
                <tr><td>Selling amount</td><td>{aud(sell)}</td></tr>
                <tr><td>Less: total selling cost</td><td>{aud(-sellingCostTotal)}</td></tr>
                <tr><td style={{ fontWeight: 700 }}>Net selling amount</td><td style={{ fontWeight: 800 }}>{aud(net)}</td></tr>
                <tr><td>Less: purchase amount</td><td>{aud(-purchase)}</td></tr>
                <tr><td>Less: property cost base (settlement entries excluded)</td><td>{aud(-costBaseTotal)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className={isGain ? "cg-pdf-result" : "cg-pdf-result is-loss"}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase" }}>
                {isGain ? "Capital gain" : "Capital loss"}
              </div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>Net selling amount − purchase amount − property cost base</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{aud(result)}</div>
          </div>
          {hasSellingCost && validRows.length ? (
            <div>
              <h3>Selling costs</h3>
              <table className="cg-pdf-small">
                <thead>
                  <tr><th>Subcategory</th><th>Description</th><th>Date</th><th className="cg-num">Amount</th></tr>
                </thead>
                <tbody>
                  {validRows.map((r) => (
                    <tr key={r.key}>
                      <td>{r.subcategory || "—"}</td>
                      <td>{r.description || "—"}</td>
                      <td>{displayDate(r.date)}</td>
                      <td className="cg-num">{aud(parseMoney(r.amount))}</td>
                    </tr>
                  ))}
                  <tr><td colSpan={3} style={{ fontWeight: 700 }}>Total</td><td className="cg-num" style={{ fontWeight: 700 }}>{aud(sellingCostTotal)}</td></tr>
                </tbody>
              </table>
            </div>
          ) : null}
          <div>
            <h3>Property cost base breakdown</h3>
            <table className="cg-pdf-small">
              <thead>
                <tr><th>Category</th><th>Description</th><th>Date</th><th className="cg-num">Amount</th></tr>
              </thead>
              <tbody>
                {costBase.map((l) => (
                  <tr key={l.id}>
                    <td>{l.category}</td>
                    <td>{l.description}</td>
                    <td>{displayDate(l.date)}</td>
                    <td className="cg-num">{aud(amountOf(l))}</td>
                  </tr>
                ))}
                <tr><td colSpan={3} style={{ fontWeight: 700 }}>Total property cost base</td><td className="cg-num" style={{ fontWeight: 700 }}>{aud(costBaseTotal)}</td></tr>
              </tbody>
            </table>
          </div>
          <div style={{ borderTop: "1px solid #e1e5f0", paddingTop: 10, fontSize: 10, color: "#8a90ad" }}>
            {gstBasisNote} This report shows the figures entered in ClearPortfolio. It is not tax advice; check CGT discount and
            exemptions with your accountant.
          </div>
        </div>
      </div>
    </div>
  );
}
