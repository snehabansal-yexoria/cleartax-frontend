"use client";

import { Fragment, useMemo, useState } from "react";
import { CURRENT_ASSET_ACCOUNTS } from "./balanceSheetAccounts";
import type { OpeningBalance } from "./balanceSheetApi";

function parseAmount(v: string) {
  const n = parseFloat(v.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Add / Edit Opening Balance. Opening balances apply to Current Assets only,
 * so the panel lists the Current Asset accounts (1010–1499) with one amount
 * each. Everything else on the balance sheet comes from transactions and
 * journal entries.
 */
export default function OpeningBalanceDrawer({
  initial,
  defaultAsAt,
  saving,
  error,
  onCancel,
  onSave,
}: {
  initial: OpeningBalance | null;
  defaultAsAt: string;
  saving: boolean;
  error: string;
  onCancel: () => void;
  onSave: (value: OpeningBalance) => void;
}) {
  const [asAt, setAsAt] = useState(initial?.asAt ?? defaultAsAt);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries((initial?.lines ?? []).map((l) => [l.code, l.amount ? l.amount.toFixed(2) : ""])),
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CURRENT_ASSET_ACCOUNTS.filter((a) => {
      if (q) return `${a.code} ${a.name} ${a.subcategory}`.toLowerCase().includes(q);
      // Default view: the main accounts plus anything that already has a value.
      return showAll || Boolean(values[a.code]) || ["1010", "1011", "1013", "1020", "1021", "1030", "1040", "1041", "1050"].includes(a.code);
    });
  }, [query, showAll, values]);

  const grouped = useMemo(() => {
    const out: { name: string; rows: typeof visible }[] = [];
    for (const a of visible) {
      const last = out[out.length - 1];
      if (last && last.name === a.subcategory) last.rows.push(a);
      else out.push({ name: a.subcategory, rows: [a] });
    }
    return out;
  }, [visible]);

  const total = Object.values(values).reduce((a, v) => a + parseAmount(v), 0);
  const isEdit = Boolean(initial);

  const save = () => {
    onSave({
      asAt,
      lines: Object.entries(values)
        .map(([code, v]) => ({ code, amount: parseAmount(v) }))
        .filter((l) => l.amount !== 0),
    });
  };

  return (
    <>
      <div className="bs-shade" onClick={onCancel} aria-hidden="true" />
      <aside className="bs-drawer" role="dialog" aria-modal="true" aria-label={isEdit ? "Edit Opening Balance" : "Add Opening Balance"}>
        <div className="bs-drawer-head">
          <div style={{ flex: 1 }}>
            <h2>{isEdit ? "Edit Opening Balance" : "Add Opening Balance"}</h2>
            <p>
              Opening balances are entered for <b>Current Assets</b> only. Everything else comes from transactions
              and journal entries.
            </p>
          </div>
          <button type="button" className="bs-btn" style={{ width: 40, padding: 0 }} aria-label="Close" onClick={onCancel}>
            ✕
          </button>
        </div>
        <div style={{ padding: "16px 24px", display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 }}>
            Opening balance as at
            <input className="bs-date" type="date" value={asAt} onChange={(e) => setAsAt(e.target.value)} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, flex: 1, minWidth: 200 }}>
            Find an account
            <input className="bs-search" placeholder="Code or name" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>
        <div className="bs-drawer-body">
          <table className="bs-ob">
            <thead>
              <tr>
                <th style={{ width: 70 }}>Code</th>
                <th>Current asset account</th>
                <th style={{ textAlign: "right" }}>Opening balance (A$)</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => (
                <Fragment key={g.name}>
                  <tr className="bs-ob-group">
                    <td colSpan={3}>{g.name}</td>
                  </tr>
                  {g.rows.map((a) => (
                    <tr key={a.code}>
                      <td>{a.code}</td>
                      <td>{a.name}</td>
                      <td style={{ textAlign: "right" }}>
                        <input
                          aria-label={`Opening balance for ${a.name}`}
                          inputMode="decimal"
                          placeholder="0.00"
                          value={values[a.code] ?? ""}
                          onChange={(e) => setValues((prev) => ({ ...prev, [a.code]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {grouped.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ color: "#64748b", padding: 16 }}>
                    No current asset account matches “{query}”.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {!query ? (
            <button type="button" className="bs-btn" style={{ marginTop: 14 }} onClick={() => setShowAll((s) => !s)}>
              {showAll ? "Show main accounts only" : `Show all ${CURRENT_ASSET_ACCOUNTS.length} current asset accounts`}
            </button>
          ) : null}
        </div>
        <div className="bs-drawer-foot">
          <div style={{ flex: 1, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
            Total current assets{" "}
            <b>${total.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
            {error ? <div style={{ color: "#dc2626", fontSize: 13, marginTop: 4 }}>{error}</div> : null}
          </div>
          <button type="button" className="bs-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="bs-btn is-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save opening balance"}
          </button>
        </div>
      </aside>
    </>
  );
}
