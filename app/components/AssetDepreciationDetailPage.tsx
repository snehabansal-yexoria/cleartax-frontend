"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";

interface ScheduleRow {
  fy: string;
  daysHeld: number;
  openingValue: number;
  rate: number;
  depreciation: number;
  closingValue: number;
}

export type AssetDepreciationDetailPageProps = {
  assetId: string;
  clientId: string;
  entityId?: string;
  propertyId?: string;
  backHref: string;
  clientName?: string;
  entityName?: string;
  propertyName?: string;
};

// Dynamic depreciation calculation engine
function calculateDepreciationSchedule(
  startDateStr: string,
  cost: number,
  businessUsePercent: number = 90,
  lifeYears: number = 5
) {
  const startDate = new Date(startDateStr);
  if (isNaN(startDate.getTime())) {
    return { rows: [], depreciableAmount: 0, ratePercent: 0, closingValue: 0, rateText: "", endDateStr: "", startDateStr: "" };
  }

  const ratePercent = 200 / lifeYears;
  const rateFraction = ratePercent / 100;
  const depreciableAmount = Math.abs(cost) * (businessUsePercent / 100);

  const endDate = new Date(startDate);
  endDate.setFullYear(startDate.getFullYear() + lifeYears);

  const getDaysInclusive = (d1: Date, d2: Date) => {
    const timeDiff = d2.getTime() - d1.getTime();
    return Math.round(timeDiff / (1000 * 60 * 60 * 24)) + 1;
  };

  const rows: ScheduleRow[] = [];
  let currentOpening = depreciableAmount;
  let currentDate = new Date(startDate);

  while (currentDate < endDate) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    let fyEndYear = year;
    if (month >= 6) { // July onwards
      fyEndYear = year + 1;
    }
    const fyEndDate = new Date(fyEndYear, 5, 30); // June 30

    const periodEndDate = fyEndDate < endDate ? fyEndDate : endDate;

    const isStartPartial = currentDate.getTime() === startDate.getTime() && (currentDate.getMonth() !== 6 || currentDate.getDate() !== 1);
    const isEndPartial = periodEndDate.getTime() === endDate.getTime() && (endDate.getMonth() !== 5 || endDate.getDate() !== 30);
    const isPartial = isStartPartial || isEndPartial;

    const daysHeld = getDaysInclusive(currentDate, periodEndDate);
    let depreciation = currentOpening * rateFraction * (daysHeld / 365);
    depreciation = Math.round(depreciation * 100) / 100;

    if (depreciation > currentOpening) {
      depreciation = currentOpening;
    }

    const currentClosing = Math.round((currentOpening - depreciation) * 100) / 100;

    const fyStartLabel = fyEndYear - 1;
    const fyEndLabel = String(fyEndYear).slice(-2);
    const fy = `FY ${fyStartLabel}–${fyEndLabel}${isPartial ? " (partial)" : ""}`;

    rows.push({
      fy,
      daysHeld,
      openingValue: currentOpening,
      rate: rateFraction,
      depreciation,
      closingValue: currentClosing
    });

    currentOpening = currentClosing;
    currentDate = new Date(fyEndYear, 6, 1); // July 1
  }

  const finalClosing = rows.length > 0 ? rows[rows.length - 1].closingValue : 0;
  
  const formatDateDayMonthYear = (date: Date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return {
    rows,
    depreciableAmount,
    ratePercent,
    closingValue: finalClosing,
    rateText: `${ratePercent.toFixed(2)}% p.a. (200% ÷ ${lifeYears} yrs)`,
    endDateStr: formatDateDayMonthYear(endDate),
    startDateStr: formatDateDayMonthYear(startDate)
  };
}

export default function AssetDepreciationDetailPage({
  assetId,
  clientId,
  entityId,
  propertyId,
  backHref,
  clientName = "Satnam Singh",
  entityName = "Smith & Co.",
  propertyName = "Heaven Villa",
}: AssetDepreciationDetailPageProps) {
  const router = useRouter();
  const [selectedYear, setSelectedYear] = useState<string>("");

  // Map asset data from parameters/defaults
  const assetData = useMemo(() => {
    if (assetId === "switchboard" || assetId === "1") {
      return {
        name: "Supply and replace switchboard",
        cost: 2272.73,
        dateAdded: "2026-07-25", // 25 July 2026
        businessUse: 90,
        lifeYears: 5,
        category: "Repairs and maintenance",
      };
    }
    // Default to New split system A/C unit
    return {
      name: "New split system A/C unit",
      cost: 1681.82,
      dateAdded: "2026-05-14", // 14 May 2026
      businessUse: 90,
      lifeYears: 5,
      category: "Capital Allowances",
    };
  }, [assetId]);

  const schedule = useMemo(() => {
    return calculateDepreciationSchedule(
      assetData.dateAdded,
      assetData.cost,
      assetData.businessUse,
      assetData.lifeYears
    );
  }, [assetData]);

  const formatCurrency = (num: number) => {
    return `A$ ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <div className="client-detail-page property-detail-page property-detail-shell asset-depreciation-container">
      <style>{`
        .asset-depreciation-container {
          padding: 0 32px 60px;
        }
        @media (max-width: 768px) {
          .asset-depreciation-container {
            padding: 0 16px 40px;
          }
        }
      `}</style>

      {/* Back button and PDF button row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", marginTop: "12px" }}>
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
            transition: "color 0.2s ease"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#28336e")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px" }}>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back
        </Link>

        <button
          type="button"
          onClick={handleExportPdf}
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
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(40, 51, 110, 0.15)",
            transition: "background 0.2s ease"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#1b2559")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#28336e")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px" }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export as PDF
        </button>
      </div>

      {/* Main Title Block */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "28px", color: "#28336e", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
          {assetData.name} — Depreciation Schedule
        </h1>
        <p style={{ fontSize: "14px", color: "#828fa7", margin: "6px 0 0 0", fontWeight: 500 }}>
          {propertyName} · {entityName} · {clientName}
        </p>
      </div>

      {/* Card 1: Asset Details */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #dde4f2",
          borderRadius: "16px",
          padding: "24px 28px",
          boxShadow: "0 4px 12px rgba(16, 24, 40, 0.02)",
          marginBottom: "24px"
        }}
      >
        <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "12px", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "#828fa7", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Asset Details
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "24px 20px" }}>
          <div>
            <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#828fa7", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
              Asset Name
            </span>
            <strong style={{ fontSize: "13px", color: "#28336e", fontWeight: 700 }}>
              {assetData.name}
            </strong>
          </div>
          <div>
            <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#828fa7", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
              Client
            </span>
            <strong style={{ fontSize: "13px", color: "#28336e", fontWeight: 700 }}>
              {clientName}
            </strong>
          </div>
          <div>
            <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#828fa7", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
              Entity
            </span>
            <strong style={{ fontSize: "13px", color: "#28336e", fontWeight: 700 }}>
              {entityName}
            </strong>
          </div>
          <div>
            <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#828fa7", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
              Property
            </span>
            <strong style={{ fontSize: "13px", color: "#28336e", fontWeight: 700 }}>
              {propertyName}
            </strong>
          </div>
          <div>
            <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#828fa7", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
              Date Added
            </span>
            <strong style={{ fontSize: "13px", color: "#28336e", fontWeight: 700 }}>
              {schedule.startDateStr}
            </strong>
          </div>

          <div>
            <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#828fa7", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
              Depreciation Category
            </span>
            <strong style={{ fontSize: "13px", color: "#28336e", fontWeight: 700 }}>
              {assetData.category}
            </strong>
          </div>
          <div>
            <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#828fa7", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
              Effective Life
            </span>
            <strong style={{ fontSize: "13px", color: "#28336e", fontWeight: 700 }}>
              {assetData.lifeYears} years (user-defined — {assetData.category})
            </strong>
          </div>
          <div>
            <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#828fa7", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
              Method
            </span>
            <strong style={{ fontSize: "13px", color: "#28336e", fontWeight: 700 }}>
              Diminishing Value
            </strong>
          </div>
          <div>
            <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#828fa7", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
              Asset Cost
            </span>
            <strong style={{ fontSize: "13px", color: "#28336e", fontWeight: 700 }}>
              {formatCurrency(assetData.cost)}
            </strong>
          </div>
          <div>
            <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#828fa7", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
              Personal / Business Use
            </span>
            <strong style={{ fontSize: "13px", color: "#28336e", fontWeight: 700 }}>
              {100 - assetData.businessUse}% personal ({formatCurrency(assetData.cost * (1 - assetData.businessUse / 100))}) / {assetData.businessUse}% business ({formatCurrency(schedule.depreciableAmount)})
            </strong>
          </div>
        </div>
      </div>

      {/* Row of Three Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "24px" }}>
        {/* Card 1 */}
        <div style={{ background: "#ffffff", border: "1px solid #dde4f2", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 12px rgba(16, 24, 40, 0.02)" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#828fa7", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Depreciable Amount (Business Use)
          </span>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#28336e", marginTop: "8px", letterSpacing: "-0.02em" }}>
            {formatCurrency(schedule.depreciableAmount)}
          </div>
        </div>

        {/* Card 2 */}
        <div style={{ background: "#ffffff", border: "1px solid #dde4f2", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 12px rgba(16, 24, 40, 0.02)" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#828fa7", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Depreciation Rate
          </span>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#28336e", marginTop: "8px", letterSpacing: "-0.02em" }}>
            {schedule.rateText}
          </div>
        </div>

        {/* Card 3 - Dark Theme */}
        <div style={{ background: "#28336e", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 12px rgba(16, 24, 40, 0.05)" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Schedule Ends
          </span>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#ffffff", marginTop: "8px", letterSpacing: "-0.02em" }}>
            {schedule.endDateStr}
          </div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#4ade80", marginTop: "8px" }}>
            Closing Value: {formatCurrency(schedule.closingValue)}
          </div>
        </div>
      </div>

      {/* Card 3: Year-by-Year Depreciation Schedule Table */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #dde4f2",
          borderRadius: "16px",
          padding: "24px 28px",
          boxShadow: "0 4px 12px rgba(16, 24, 40, 0.02)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#28336e" }}>
            Year-by-Year Depreciation Schedule
          </h2>

          <div style={{ display: "flex", alignItems: "center" }}>
            <label htmlFor="jump-fy" style={{ fontSize: "13px", fontWeight: 500, color: "#64748b", marginRight: "8px" }}>
              Jump to Financial Year
            </label>
            <select
              id="jump-fy"
              value={selectedYear}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedYear(val);
                if (val) {
                  const element = document.getElementById(`row-${val}`);
                  if (element) {
                    element.scrollIntoView({ behavior: "smooth", block: "center" });
                    element.style.background = "#f0fdf4";
                    setTimeout(() => {
                      element.style.background = "transparent";
                    }, 1500);
                  }
                }
              }}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                fontSize: "13px",
                color: "#334155",
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="">Select...</option>
              {schedule.rows.map((row, idx) => (
                <option key={idx} value={row.fy}>{row.fy.replace(" (partial)", "")}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #eef2f6" }}>
                <th style={{ padding: "12px 12px", fontSize: "11px", fontWeight: 700, color: "#828fa7", textTransform: "uppercase", letterSpacing: "0.06em" }}>Financial Year</th>
                <th style={{ padding: "12px 12px", fontSize: "11px", fontWeight: 700, color: "#828fa7", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>Days Held</th>
                <th style={{ padding: "12px 12px", fontSize: "11px", fontWeight: 700, color: "#828fa7", textTransform: "uppercase", letterSpacing: "0.06em" }}>Opening Value</th>
                <th style={{ padding: "12px 12px", fontSize: "11px", fontWeight: 700, color: "#828fa7", textTransform: "uppercase", letterSpacing: "0.06em" }}>Rate</th>
                <th style={{ padding: "12px 12px", fontSize: "11px", fontWeight: 700, color: "#828fa7", textTransform: "uppercase", letterSpacing: "0.06em" }}>Depreciation</th>
                <th style={{ padding: "12px 12px", fontSize: "11px", fontWeight: 700, color: "#828fa7", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right" }}>Closing Value</th>
              </tr>
            </thead>
            <tbody>
              {schedule.rows.map((row, idx) => (
                <tr
                  key={idx}
                  id={`row-${row.fy}`}
                  style={{
                    borderBottom: idx === schedule.rows.length - 1 ? "none" : "1px solid #f1f5f9",
                    transition: "background 0.3s ease"
                  }}
                >
                  <td style={{ padding: "16px 12px", fontSize: "13px", color: "#334155", fontWeight: 500 }}>
                    {row.fy}
                  </td>
                  <td style={{ padding: "16px 12px", fontSize: "13px", color: "#334155", textAlign: "center" }}>
                    {row.daysHeld}
                  </td>
                  <td style={{ padding: "16px 12px", fontSize: "13px", color: "#334155" }}>
                    {formatCurrency(row.openingValue)}
                  </td>
                  <td style={{ padding: "16px 12px", fontSize: "13px", color: "#475569" }}>
                    {(row.rate * 100).toFixed(2)}%
                  </td>
                  <td style={{ padding: "16px 12px", fontSize: "14px", color: "#28336e", fontWeight: 700 }}>
                    {formatCurrency(row.depreciation)}
                  </td>
                  <td style={{ padding: "16px 12px", fontSize: "14px", color: "#28336e", fontWeight: 700, textAlign: "right" }}>
                    {formatCurrency(row.closingValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: "16px", fontSize: "12px", color: "#64748b", lineHeight: "1.5" }}>
          Diminishing Value depreciation is recalculated on the declining Opening Adjustable Value each year, so — unlike Prime Cost — the Closing Value is not required to reach $0.00 within the effective life.
        </div>
      </div>
    </div>
  );
}
