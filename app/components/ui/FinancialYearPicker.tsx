"use client";

import { auFinancialYearOf } from "@/app/components/useGstSummary";

/**
 * The financial-year picker for the P&L figures.
 *
 * One control, rendered twice: above the hero summary cards and in the header of
 * the statement itself. Both read the SAME `pnlFinancialYear`, which is what
 * makes it impossible for the cards to show one year while the statement shows
 * another — the mismatch this component was extracted to prevent. It was
 * previously ~90 lines of inline styles living only inside the statement header.
 *
 * Six years back by default, matching the GST summary's range beside it;
 * `years` narrows or widens that (the Portfolio Summary offers the years that
 * have data). Shared by the property P&L and the client Reports page.
 */
export default function FinancialYearPicker({
  value,
  onChange,
  isOpen,
  setIsOpen,
  years,
}: {
  value: number;
  onChange: (year: number) => void;
  isOpen: boolean;
  setIsOpen: (next: boolean) => void;
  /** Years to offer, newest first. Defaults to the current FY and five before it. */
  years?: number[];
}) {
  const label = (year: number) => `FY ${year - 1}-${String(year).slice(-2)}`;
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          minWidth: "140px",
          height: "40px",
          padding: "0 14px",
          borderRadius: "8px",
          border: isOpen ? "1.5px solid #28336e" : "1px solid #cbd5e1",
          backgroundColor: "#ffffff",
          color: "#1e293b",
          fontSize: "14px",
          fontWeight: 600,
          cursor: "pointer",
          outline: "none",
          boxShadow: isOpen ? "0 0 0 3px rgba(40, 51, 110, 0.12)" : "0 1px 2px rgba(0, 0, 0, 0.05)",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.borderColor = "#94a3b8";
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.borderColor = "#cbd5e1";
        }}
      >
        <span>{label(value)}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          style={{
            width: "14px",
            height: "14px",
            color: "#64748b",
            transition: "transform 0.2s ease",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: "160px",
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
            zIndex: 1000,
            padding: "4px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          {(years ?? Array.from({ length: 6 }, (_, i) => auFinancialYearOf(new Date()) - i)).map((year) => {
            const isSelected = year === value;
            return (
              <div
                key={year}
                onClick={() => {
                  onChange(year);
                  setIsOpen(false);
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? "#28336e" : "#334155",
                  backgroundColor: isSelected ? "#eff6ff" : "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = "#f8fafc";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span>{label(year)}</span>
                {isSelected && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "14px", height: "14px", color: "#28336e" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
