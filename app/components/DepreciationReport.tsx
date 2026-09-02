"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CoreDepreciationScopeLevel } from "@/src/lib/coreApi";
import { assetClassLabel, methodLabel } from "./AssetBuilder";
import { formatCurrency, fyLabel, useDepreciation } from "./useDepreciation";

/**
 * The Depreciation module (PRD section 9): every asset in a scope, with the
 * financial-year filter that re-totals the summary.
 *
 * The financial-year options are derived from the schedules themselves rather
 * than from a fixed range, so the picker never offers a year with nothing in
 * it. Selecting one changes the CLAIM figures only — the depreciable amount and
 * the closing value stay whole-of-life, because a filtered lifetime figure
 * would read as though the assets were nearly written off.
 */

export type DepreciationReportProps = {
  level: CoreDepreciationScopeLevel;
  id: string;
  /** Row links point here: `${assetHrefBase}/${transactionId}`. */
  assetHrefBase?: string;
  title?: string;
};

const card: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dde4f2",
  borderRadius: "16px",
  padding: "24px 28px",
  boxShadow: "0 4px 12px rgba(16, 24, 40, 0.02)",
};

const th: React.CSSProperties = {
  padding: "12px",
  fontSize: "11px",
  fontWeight: 700,
  color: "#828fa7",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  whiteSpace: "nowrap",
  textAlign: "left",
};

const td: React.CSSProperties = {
  padding: "14px 12px",
  fontSize: "13px",
  color: "#334155",
  borderBottom: "1px solid #f1f5f9",
};

export default function DepreciationReport({
  level,
  id,
  assetHrefBase,
  title = "Depreciation",
}: DepreciationReportProps) {
  const [fy, setFy] = useState<number | null>(null);
  const { data, isLoading, error, reload } = useDepreciation(level, id, { fy });

  const items = useMemo(() => data?.items ?? [], [data]);
  const totals = data?.totals;

  // The financial years the schedules actually span. Safe to derive from the
  // current response because `fy` narrows the CLAIM figures, not the item list —
  // the backend applies it to a lateral join, never to the WHERE clause — so the
  // option list cannot collapse to the year already selected.
  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    for (const item of items) {
      const startYear = Number.parseInt(item.startDate.slice(0, 4), 10);
      const startMonth = Number.parseInt(item.startDate.slice(5, 7), 10);
      if (!Number.isFinite(startYear) || !Number.isFinite(startMonth)) continue;
      // July onwards belongs to that year's FY; January to June to the previous.
      const firstFy = startMonth >= 7 ? startYear : startYear - 1;
      // Effective life plus the stub year a mid-year purchase creates.
      const span = Math.ceil(item.effectiveLifeYears) + 1;
      for (let i = 0; i < span; i += 1) years.add(firstFy + i);
    }
    return [...years].sort((a, b) => b - a);
  }, [items]);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#28336e" }}>
          {title}
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="depreciation-fy" style={{ fontSize: "13px", fontWeight: 500, color: "#64748b" }}>
            Financial Year
          </label>
          <select
            id="depreciation-fy"
            value={fy == null ? "" : String(fy)}
            onChange={(e) => setFy(e.target.value ? Number(e.target.value) : null)}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              fontSize: "13px",
              color: "#334155",
              cursor: "pointer",
            }}
          >
            <option value="">All years</option>
            {yearOptions.map((y) => (
              <option key={y} value={String(y)}>
                {fyLabel(y)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div style={{ ...card, borderColor: "#fecaca", background: "#fef2f2" }}>
          <p style={{ margin: 0, color: "#b91c1c", fontSize: "14px", fontWeight: 600 }}>{error}</p>
          <button
            type="button"
            onClick={reload}
            style={{
              marginTop: "12px",
              background: "#28336e",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* ---- Summary ------------------------------------------------------ */}
      {totals && !error && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          <Stat
            label={fy == null ? "Total Depreciation" : `${fyLabel(fy)} Deduction`}
            value={formatCurrency(totals.depreciation)}
            note={fy == null ? "over the effective life" : undefined}
          />
          <Stat label="Capital Works (Div 43)" value={formatCurrency(totals.capitalWorks)} />
          <Stat label="Capital Allowances (Div 40)" value={formatCurrency(totals.capitalAllowances)} />
          <Stat
            label="Assets"
            value={String(totals.assetCount)}
            note={`${formatCurrency(totals.depreciableAmount)} depreciable`}
          />
        </div>
      )}

      {/* ---- Asset table --------------------------------------------------- */}
      <div style={card}>
        {isLoading ? (
          <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>Loading schedules…</p>
        ) : items.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b", fontSize: "14px", lineHeight: 1.55 }}>
            No depreciating assets yet. A schedule is generated automatically when a
            transaction is saved as an asset purchase with a category, an effective life and a
            method.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #eef2f6" }}>
                  <th style={th}>Asset</th>
                  <th style={th}>Property</th>
                  <th style={th}>Category</th>
                  <th style={th}>Method</th>
                  <th style={{ ...th, textAlign: "right" }}>Life</th>
                  <th style={{ ...th, textAlign: "right" }}>Rate</th>
                  <th style={{ ...th, textAlign: "right" }}>Depreciable</th>
                  <th style={{ ...th, textAlign: "right" }}>
                    {fy == null ? "Total Claim" : `${fyLabel(fy)} Claim`}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const claim =
                    fy == null ? item.totalDepreciation : item.fyDepreciation ?? 0;
                  const name = assetHrefBase ? (
                    <Link
                      href={`${assetHrefBase}/${encodeURIComponent(item.transactionId)}`}
                      style={{ color: "#28336e", fontWeight: 700, textDecoration: "none" }}
                    >
                      {item.assetName}
                    </Link>
                  ) : (
                    <strong style={{ color: "#28336e" }}>{item.assetName}</strong>
                  );

                  return (
                    <tr key={item.id}>
                      <td style={td}>
                        {name}
                        {item.personalPercentage > 0 && (
                          <div style={{ fontSize: "11px", color: "#828fa7", marginTop: "2px" }}>
                            {item.businessPercentage}% business use
                          </div>
                        )}
                      </td>
                      <td style={td}>{item.propertyName}</td>
                      <td style={td}>{assetClassLabel(item.assetClass)}</td>
                      <td style={td}>{methodLabel(item.depreciationMethod)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{item.effectiveLifeYears} yrs</td>
                      <td style={{ ...td, textAlign: "right" }}>{item.annualRate.toFixed(2)}%</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        {formatCurrency(item.depreciableAmount)}
                      </td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#28336e" }}>
                        {formatCurrency(claim)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div style={{ ...card, padding: "20px 22px" }}>
      <span
        style={{
          fontSize: "11px",
          fontWeight: 700,
          color: "#828fa7",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
      <div style={{ fontSize: "24px", fontWeight: 700, color: "#28336e", marginTop: "8px", letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {note && (
        <div style={{ fontSize: "12px", color: "#828fa7", marginTop: "6px" }}>{note}</div>
      )}
    </div>
  );
}
