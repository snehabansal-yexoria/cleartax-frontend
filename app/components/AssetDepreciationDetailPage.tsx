"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CoreDepreciationSchedule } from "@/src/lib/coreApi";
import {
  assetClassLabel,
  methodLabel,
} from "./AssetBuilder";
import {
  downloadDepreciationDocument,
  formatCurrency,
  fyLabel,
  useDepreciation,
} from "./useDepreciation";

/**
 * The per-asset depreciation report (PRD section 9).
 *
 * This page used to invent its data: two hardcoded assets, a hardcoded client
 * name, 90% business use and a 5-year life baked in, every schedule labelled
 * "Diminishing Value" regardless — and its own calculation engine, which
 * disagreed with the backend about leap years (it counted a full financial year
 * as 366 days and divided by 365) and about where a schedule ends (it stopped
 * `life` calendar years after purchase rather than at the end of the effective
 * life).
 *
 * Everything below is now rendered from the stored schedule. The engine lives
 * in the backend, in one place, and these are the same rows the generated PDF
 * is built from — so what the accountant sees on screen and what the client
 * receives as a document cannot disagree.
 *
 * The asset id in the route is the TRANSACTION id: an asset is a transaction
 * with is_asset_purchase, and a transaction split across two properties has one
 * schedule per property, which is why this renders a list.
 */

export type AssetDepreciationDetailPageProps = {
  /** The asset's transaction id. */
  assetId: string;
  clientId: string;
  entityId?: string;
  propertyId?: string;
  backHref: string;
};

const card: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dde4f2",
  borderRadius: "16px",
  padding: "24px 28px",
  boxShadow: "0 4px 12px rgba(16, 24, 40, 0.02)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "10px",
  fontWeight: 700,
  color: "#828fa7",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "4px",
};

const valueStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#28336e",
  fontWeight: 700,
};

const thStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: "11px",
  fontWeight: 700,
  color: "#828fa7",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  whiteSpace: "nowrap",
};

export default function AssetDepreciationDetailPage({
  assetId,
  backHref,
}: AssetDepreciationDetailPageProps) {
  const { data, isLoading, error, reload } = useDepreciation("transaction", assetId);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const schedules = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="client-detail-page property-detail-page property-detail-shell asset-depreciation-container">
        <BackLink backHref={backHref} />
        <p style={{ color: "#64748b", fontSize: "14px" }}>Loading depreciation schedule…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="client-detail-page property-detail-page property-detail-shell asset-depreciation-container">
        <BackLink backHref={backHref} />
        <div style={{ ...card, borderColor: "#fecaca", background: "#fef2f2" }}>
          <p style={{ margin: 0, color: "#b91c1c", fontSize: "14px", fontWeight: 600 }}>
            {error}
          </p>
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
      </div>
    );
  }

  if (schedules.length === 0) {
    return (
      <div className="client-detail-page property-detail-page property-detail-shell asset-depreciation-container">
        <BackLink backHref={backHref} />
        <div style={card}>
          <h2 style={{ margin: 0, fontSize: "18px", color: "#28336e", fontWeight: 700 }}>
            No depreciation schedule for this transaction
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#64748b", lineHeight: 1.55 }}>
            A schedule is generated when a transaction is saved as an asset purchase with a
            depreciation category, an effective life and a method. If this transaction was
            recently marked as an asset, reopen it and save it again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="client-detail-page property-detail-page property-detail-shell asset-depreciation-container">
      <style>{`
        .asset-depreciation-container { padding: 0 32px 60px; }
        @media (max-width: 768px) { .asset-depreciation-container { padding: 0 16px 40px; } }
        @media print {
          .asset-depreciation-noprint { display: none !important; }
          .asset-depreciation-container { padding: 0; }
        }
      `}</style>

      <div
        className="asset-depreciation-noprint"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          marginTop: "12px",
        }}
      >
        <BackLink backHref={backHref} inline />
      </div>

      {downloadError && (
        <p style={{ color: "#b91c1c", fontSize: "13px", fontWeight: 600, marginBottom: "16px" }}>
          {downloadError}
        </p>
      )}

      {schedules.map((schedule) => (
        <ScheduleReport
          key={schedule.id}
          schedule={schedule}
          onDownloadError={setDownloadError}
          multiProperty={schedules.length > 1}
        />
      ))}
    </div>
  );
}

function BackLink({ backHref, inline }: { backHref: string; inline?: boolean }) {
  return (
    <Link
      href={backHref}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        color: "#475569",
        textDecoration: "none",
        fontSize: "14px",
        fontWeight: 600,
        marginBottom: inline ? 0 : "24px",
        marginTop: inline ? 0 : "12px",
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px" }}>
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
      Back
    </Link>
  );
}

function ScheduleReport({
  schedule,
  onDownloadError,
  multiProperty,
}: {
  schedule: CoreDepreciationSchedule;
  onDownloadError: (message: string | null) => void;
  multiProperty: boolean;
}) {
  const [selectedFy, setSelectedFy] = useState<string>("");
  const [downloading, setDownloading] = useState(false);

  const years = schedule.years;

  // The summary re-totals when a financial year is picked (PRD section 9). With
  // no year selected it shows the whole life.
  const selected = useMemo(
    () => years.find((y) => String(y.fyStartYear) === selectedFy) ?? null,
    [years, selectedFy],
  );

  const totalDepreciation = schedule.totalDepreciation;
  const finalClosing = years.length ? years[years.length - 1].closingAdjustableValue : 0;
  const scheduleEnds = years.length ? years[years.length - 1].periodEnd : "";

  const handleDownload = async () => {
    setDownloading(true);
    onDownloadError(null);
    try {
      await downloadDepreciationDocument(schedule.id, schedule.documentName);
    } catch (err) {
      onDownloadError(
        err instanceof Error ? err.message : "Could not download the schedule.",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section style={{ marginBottom: multiProperty ? "48px" : 0 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "28px",
              color: "#28336e",
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            {schedule.assetName} — Depreciation Schedule
          </h1>
          <p style={{ fontSize: "14px", color: "#828fa7", margin: "6px 0 0", fontWeight: 500 }}>
            {[schedule.propertyName, schedule.entityName].filter(Boolean).join(" · ")}
          </p>
        </div>

        <button
          type="button"
          className="asset-depreciation-noprint"
          onClick={handleDownload}
          disabled={downloading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "#28336e",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            padding: "8px 16px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: downloading ? "wait" : "pointer",
            opacity: downloading ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px" }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {downloading ? "Preparing…" : "Download PDF"}
        </button>
      </div>

      {/* ---- Asset details -------------------------------------------------- */}
      <div style={{ ...card, marginBottom: "24px" }}>
        <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "12px", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "#828fa7", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Asset Details
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "24px 20px" }}>
          <Detail label="Asset Name" value={schedule.assetName} />
          <Detail label="Property" value={schedule.propertyName} />
          <Detail label="Entity" value={schedule.entityName} />
          <Detail label="Date Acquired" value={formatDate(schedule.startDate)} />
          <Detail label="Depreciation Category" value={assetClassLabel(schedule.assetClass)} />
          <Detail
            label="Effective Life"
            value={`${schedule.effectiveLifeYears} years${
              schedule.assetClass === "capital_works" ? " (statutory)" : ""
            }`}
          />
          <Detail label="Method" value={methodLabel(schedule.depreciationMethod)} />
          <Detail label="Asset Cost" value={formatCurrency(schedule.costBase)} />
          <Detail
            label="Private / Business Use"
            value={
              schedule.personalPercentage > 0
                ? `${schedule.personalPercentage}% private / ${schedule.businessPercentage}% business`
                : "100% business"
            }
          />
        </div>
      </div>

      {/* ---- Summary -------------------------------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <Stat
          label="Depreciable Amount (Business Use)"
          value={formatCurrency(schedule.depreciableAmount)}
        />
        <Stat
          label="Depreciation Rate"
          value={`${schedule.annualRate.toFixed(2)}% p.a.`}
          note={`${schedule.depreciationMethod === "diminishing_value" ? "200%" : "100%"} ÷ ${schedule.effectiveLifeYears} yrs`}
        />
        <Stat
          label={selected ? `${fyLabel(selected.fyStartYear)} Deduction` : "Total Depreciation"}
          value={formatCurrency(selected ? selected.depreciation : totalDepreciation)}
          note={selected ? `${selected.daysHeld} days held` : "over the effective life"}
        />
        <Stat
          dark
          label="Schedule Ends"
          value={formatDate(scheduleEnds)}
          note={`Closing Value: ${formatCurrency(finalClosing)}`}
        />
      </div>

      {/* ---- Year-by-year table --------------------------------------------- */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#28336e" }}>
            Year-by-Year Depreciation Schedule
          </h2>

          <div className="asset-depreciation-noprint" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label htmlFor={`fy-${schedule.id}`} style={{ fontSize: "13px", fontWeight: 500, color: "#64748b" }}>
              Financial Year
            </label>
            <select
              id={`fy-${schedule.id}`}
              value={selectedFy}
              onChange={(e) => setSelectedFy(e.target.value)}
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
              {years.map((y) => (
                <option key={y.fyStartYear} value={String(y.fyStartYear)}>
                  {fyLabel(y.fyStartYear)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #eef2f6" }}>
                <th style={thStyle}>Financial Year</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Days Held</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Opening Value</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Rate</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Depreciation</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Closing Value</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y, idx) => {
                const isSelected = String(y.fyStartYear) === selectedFy;
                return (
                  <tr
                    key={y.fyStartYear}
                    style={{
                      borderBottom: idx === years.length - 1 ? "none" : "1px solid #f1f5f9",
                      background: isSelected ? "#f0fdf4" : "transparent",
                    }}
                  >
                    <td style={{ padding: "16px 12px", fontSize: "13px", color: "#334155", fontWeight: 500 }}>
                      {fyLabel(y.fyStartYear)}
                      {y.isPartial && (
                        <span style={{ color: "#828fa7", fontWeight: 500 }}> (part year)</span>
                      )}
                    </td>
                    <td style={{ padding: "16px 12px", fontSize: "13px", color: "#334155", textAlign: "center" }}>
                      {y.daysHeld}
                    </td>
                    <td style={{ padding: "16px 12px", fontSize: "13px", color: "#334155", textAlign: "right" }}>
                      {formatCurrency(y.openingAdjustableValue)}
                    </td>
                    <td style={{ padding: "16px 12px", fontSize: "13px", color: "#475569", textAlign: "right" }}>
                      {y.rate.toFixed(2)}%
                    </td>
                    <td style={{ padding: "16px 12px", fontSize: "14px", color: "#28336e", fontWeight: 700, textAlign: "right" }}>
                      {formatCurrency(y.depreciation)}
                    </td>
                    <td style={{ padding: "16px 12px", fontSize: "14px", color: "#28336e", fontWeight: 700, textAlign: "right" }}>
                      {formatCurrency(y.closingAdjustableValue)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #eef2f6", background: "#f8fafc" }}>
                <td colSpan={4} style={{ padding: "14px 12px", fontSize: "12px", fontWeight: 700, color: "#475569", textAlign: "right", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Total over the effective life
                </td>
                <td style={{ padding: "14px 12px", fontSize: "14px", fontWeight: 700, color: "#28336e", textAlign: "right" }}>
                  {formatCurrency(totalDepreciation)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={{ marginTop: "16px", fontSize: "12px", color: "#64748b", lineHeight: 1.55, display: "flex", flexDirection: "column", gap: "6px" }}>
          <span>
            Financial years run 1 July to 30 June. The year of acquisition and the final year
            are prorated by days held over 365; every full financial year receives the annual
            amount.
          </span>
          {schedule.depreciationMethod === "diminishing_value" && (
            <span>
              Diminishing value depreciation is recalculated on the declining opening
              adjustable value each year, so — unlike prime cost — the closing value is not
              required to reach {formatCurrency(0)} within the effective life.
            </span>
          )}
          {schedule.personalPercentage > 0 && (
            <span>
              Depreciation is calculated on the business-use portion only.{" "}
              {schedule.personalPercentage}% of this asset was recorded as private use and is
              excluded from the depreciable amount.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <strong style={valueStyle}>{value}</strong>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  dark,
}: {
  label: string;
  value: string;
  note?: string;
  dark?: boolean;
}) {
  return (
    <div
      style={{
        ...card,
        padding: "24px",
        background: dark ? "#28336e" : "#ffffff",
        border: dark ? "none" : "1px solid #dde4f2",
      }}
    >
      <span
        style={{
          fontSize: "11px",
          fontWeight: 700,
          color: dark ? "#94a3b8" : "#828fa7",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
      <div
        style={{
          fontSize: "26px",
          fontWeight: 700,
          color: dark ? "#ffffff" : "#28336e",
          marginTop: "8px",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      {note && (
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: dark ? "#4ade80" : "#828fa7",
            marginTop: "8px",
          }}
        >
          {note}
        </div>
      )}
    </div>
  );
}

/** dd/mm/yyyy from an ISO date, without dragging in a date library. */
function formatDate(iso: string): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}
