"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSession } from "@/src/lib/session";
import type { CoreGstScopeLevel, CoreGstSummary } from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): { getJwtToken(): string };
}

export type GstSummaryScope = {
  level: CoreGstScopeLevel;
  id: string;
  /** Shown in the modal subtitle; the API also returns a name, this is the
   *  optimistic one so the header isn't blank while the first fetch runs. */
  name: string;
};

export type GstSummaryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  scope: GstSummaryScope;
};

/** Whole-year option in the quarter selector. */
const FULL_YEAR = 0;

const QUARTER_LABELS: Record<number, string> = {
  1: "Q1 · Jul–Sep",
  2: "Q2 · Oct–Dec",
  3: "Q3 · Jan–Mar",
  4: "Q4 · Apr–Jun",
};

/**
 * Australian financial year a date falls in: FY2026 = 1 Jul 2025 – 30 Jun 2026.
 * July onwards belongs to the next FY.
 */
function financialYearOf(date: Date): number {
  return date.getMonth() >= 6 ? date.getFullYear() + 1 : date.getFullYear();
}

/** BAS quarter (1-4) a date falls in. */
function quarterOf(date: Date): number {
  const m = date.getMonth();
  if (m >= 6 && m <= 8) return 1; // Jul–Sep
  if (m >= 9) return 2; // Oct–Dec
  if (m <= 2) return 3; // Jan–Mar
  return 4; // Apr–Jun
}

function endpointFor(scope: GstSummaryScope): string {
  switch (scope.level) {
    case "entity":
      return `/api/entities/${encodeURIComponent(scope.id)}/gst-summary`;
    case "client":
      return `/api/clients/${encodeURIComponent(scope.id)}/gst-summary`;
    default:
      return `/api/properties/${encodeURIComponent(scope.id)}/gst-summary`;
  }
}

export default function GstSummaryModal({
  isOpen,
  onClose,
  scope,
}: GstSummaryModalProps) {
  const now = useMemo(() => new Date(), []);
  const currentFy = financialYearOf(now);

  const [financialYear, setFinancialYear] = useState(currentFy);
  const [quarter, setQuarter] = useState(quarterOf(now));
  const [summary, setSummary] = useState<CoreGstSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isFyDropdownOpen, setIsFyDropdownOpen] = useState(false);
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!isFyDropdownOpen && !isPeriodDropdownOpen) return;
    const handleClose = () => {
      setIsFyDropdownOpen(false);
      setIsPeriodDropdownOpen(false);
    };
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, [isFyDropdownOpen, isPeriodDropdownOpen]);

  const fyOptions = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => currentFy - i).map((year) => ({
        value: year,
        label: `FY${year} (Jul ${year - 1} – Jun ${year})`,
      })),
    [currentFy],
  );

  const periodOptions = useMemo(
    () => [
      { value: 1, label: QUARTER_LABELS[1] },
      { value: 2, label: QUARTER_LABELS[2] },
      { value: 3, label: QUARTER_LABELS[3] },
      { value: 4, label: QUARTER_LABELS[4] },
      { value: FULL_YEAR, label: "Full financial year" },
    ],
    [],
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const session = (await getSession()) as SessionWithIdToken | null;
      const token = session?.getIdToken().getJwtToken();
      if (!token) throw new Error("Your session has expired. Please sign in again.");

      const params = new URLSearchParams({
        financial_year: String(financialYear),
      });
      if (quarter !== FULL_YEAR) params.set("quarter", String(quarter));

      const res = await fetch(`${endpointFor(scope)}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message || `Could not load the GST summary (${res.status}).`,
        );
      }
      setSummary((await res.json()) as CoreGstSummary);
    } catch (err) {
      setSummary(null);
      setError(err instanceof Error ? err.message : "Could not load the GST summary.");
    } finally {
      setIsLoading(false);
    }
  }, [financialYear, quarter, scope]);

  useEffect(() => {
    if (!isOpen) return;
    void load();
  }, [isOpen, load]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatGst = (val: number) => {
    const formatted = Math.abs(val).toLocaleString("en-AU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `A$ ${formatted}`;
  };

  const gstSales = summary?.gstOnSales ?? 0;
  const gstPurchases = summary?.gstOnPurchases ?? 0;
  const totalIncomeVal = summary?.salesNet ?? 0;
  const totalSalesVal = summary?.g1TotalSales ?? 0;
  const refundOrPayment = gstPurchases - gstSales;
  const gstPeriodLabel = summary?.period.label ?? "";

  const handleExportGstCsv = () => {
    const targetName = summary?.scope.name || scope.name || "Entity";
    const lines = [
      `GST Summary - ${targetName}`,
      gstPeriodLabel
        ? `${gstPeriodLabel} (${summary?.period.from} to ${summary?.period.to})`
        : `Current period`,
      `Accruals basis - dated by invoice date`,
      ``,
      `Code,Field,Amount`,
      `G1,Total Sales,${formatGst(totalSalesVal)}`,
      `1A,GST on Sales,${formatGst(gstSales)}`,
      `1B,GST on Purchases,${formatGst(gstPurchases)}`,
      `9,Refund / Payment Due,${formatGst(Math.abs(refundOrPayment))}`,
      ``,
      `${refundOrPayment >= 0 ? "Refund Due from ATO" : "Payment Due to ATO"},,${formatGst(Math.abs(refundOrPayment))}`,
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GST_Summary_${targetName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "540px",
          maxHeight: "min(760px, 92vh)",
          boxShadow:
            "0 20px 40px -10px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(15, 23, 42, 0.04)",
          display: "flex",
          flexDirection: "column",
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: "var(--primary, #28336e)",
            padding: "18px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#ffffff",
            borderTopLeftRadius: "20px",
            borderTopRightRadius: "20px",
            flexShrink: 0,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              GST Summary
            </h2>
            <div
              style={{
                fontSize: "12px",
                color: "#c7d2fe",
                marginTop: "2px",
                fontWeight: 500,
              }}
            >
              {summary?.scope.name || scope.name}
              {gstPeriodLabel ? ` · ${gstPeriodLabel}` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close GST summary"
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "10px",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#cbd5e1",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
              e.currentTarget.style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
              e.currentTarget.style.color = "#cbd5e1";
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{ width: "16px", height: "16px" }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            overflowY: "auto",
            flex: "1 1 auto",
          }}
        >
          {/* Period selectors — custom dropdowns */}
          <div style={{ display: "flex", gap: "12px", zIndex: 100 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                flex: "1",
                position: "relative",
              }}
            >
              <span style={{ fontSize: "12px", fontWeight: 650, color: "#475569" }}>
                Financial year
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFyDropdownOpen(!isFyDropdownOpen);
                  setIsPeriodDropdownOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  minHeight: "36px",
                  padding: "0 12px",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: "8px",
                  backgroundColor: "#ffffff",
                  color: "#1e293b",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                  outline: "none",
                  boxShadow: isFyDropdownOpen
                    ? "0 0 0 3px rgba(40, 51, 110, 0.12)"
                    : "none",
                  borderColor: isFyDropdownOpen ? "var(--primary, #28336e)" : "#cbd5e1",
                }}
                onMouseEnter={(e) => {
                  if (!isFyDropdownOpen) e.currentTarget.style.borderColor = "#94a3b8";
                }}
                onMouseLeave={(e) => {
                  if (!isFyDropdownOpen) e.currentTarget.style.borderColor = "#cbd5e1";
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {fyOptions.find((o) => o.value === financialYear)?.label}
                </span>
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
                    transform: isFyDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {isFyDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    boxShadow:
                      "0 8px 16px -4px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)",
                    zIndex: 1000,
                    padding: "4px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1px",
                  }}
                >
                  {fyOptions.map((option) => {
                    const isSelected = option.value === financialYear;
                    return (
                      <div
                        key={option.value}
                        onClick={() => {
                          setFinancialYear(option.value);
                          setIsFyDropdownOpen(false);
                        }}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          fontSize: "13px",
                          fontWeight: isSelected ? 600 : 500,
                          color: isSelected ? "var(--primary, #28336e)" : "#334155",
                          backgroundColor: isSelected ? "#eff6ff" : "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = isSelected
                            ? "#eff6ff"
                            : "#f1f5f9";
                          if (!isSelected) e.currentTarget.style.color = "#0f172a";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = isSelected
                            ? "#eff6ff"
                            : "transparent";
                          if (!isSelected) e.currentTarget.style.color = "#334155";
                        }}
                      >
                        <span>{option.label}</span>
                        {isSelected && (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            style={{
                              width: "14px",
                              height: "14px",
                              color: "var(--primary, #28336e)",
                            }}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="m4.5 12.75 6 6 9-13.5"
                            />
                          </svg>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                flex: "1",
                position: "relative",
              }}
            >
              <span style={{ fontSize: "12px", fontWeight: 650, color: "#475569" }}>
                Period
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPeriodDropdownOpen(!isPeriodDropdownOpen);
                  setIsFyDropdownOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  minHeight: "36px",
                  padding: "0 12px",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: "8px",
                  backgroundColor: "#ffffff",
                  color: "#1e293b",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                  outline: "none",
                  boxShadow: isPeriodDropdownOpen
                    ? "0 0 0 3px rgba(40, 51, 110, 0.12)"
                    : "none",
                  borderColor: isPeriodDropdownOpen
                    ? "var(--primary, #28336e)"
                    : "#cbd5e1",
                }}
                onMouseEnter={(e) => {
                  if (!isPeriodDropdownOpen) e.currentTarget.style.borderColor = "#94a3b8";
                }}
                onMouseLeave={(e) => {
                  if (!isPeriodDropdownOpen) e.currentTarget.style.borderColor = "#cbd5e1";
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {periodOptions.find((o) => o.value === quarter)?.label}
                </span>
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
                    transform: isPeriodDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {isPeriodDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    boxShadow:
                      "0 8px 16px -4px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)",
                    zIndex: 1000,
                    padding: "4px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1px",
                  }}
                >
                  {periodOptions.map((option) => {
                    const isSelected = option.value === quarter;
                    return (
                      <div
                        key={option.value}
                        onClick={() => {
                          setQuarter(option.value);
                          setIsPeriodDropdownOpen(false);
                        }}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          fontSize: "13px",
                          fontWeight: isSelected ? 600 : 500,
                          color: isSelected ? "var(--primary, #28336e)" : "#334155",
                          backgroundColor: isSelected ? "#eff6ff" : "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = isSelected
                            ? "#eff6ff"
                            : "#f1f5f9";
                          if (!isSelected) e.currentTarget.style.color = "#0f172a";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = isSelected
                            ? "#eff6ff"
                            : "transparent";
                          if (!isSelected) e.currentTarget.style.color = "#334155";
                        }}
                      >
                        <span>{option.label}</span>
                        {isSelected && (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            style={{
                              width: "14px",
                              height: "14px",
                              color: "var(--primary, #28336e)",
                            }}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="m4.5 12.75 6 6 9-13.5"
                            />
                          </svg>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {isLoading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#64748b",
                padding: "4px 2px",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                style={{
                  width: "16px",
                  height: "16px",
                  animation: "spin 1s linear infinite",
                }}
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="#cbd5e1"
                  strokeWidth="3"
                  fill="none"
                  style={{ opacity: 0.3 }}
                />
                <path
                  d="M12 2a10 10 0 0 1 10 10"
                  stroke="var(--primary, #28336e)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              <span>Updating figures…</span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#b42318",
                backgroundColor: "#fef3f2",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #fda29b",
              }}
            >
              {error}
            </div>
          )}

          {/* Table Column Headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "56px 1fr 120px",
              paddingBottom: "8px",
              borderBottom: "2px solid #f1f5f9",
              fontSize: "11px",
              fontWeight: 700,
              color: "#475569",
              textTransform: "uppercase",
              letterSpacing: "0.075em",
            }}
          >
            <div>Code</div>
            <div>Field</div>
            <div style={{ textAlign: "right" }}>Amount</div>
          </div>

          {/* Rows */}
          {/* Row G1 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "56px 1fr 120px",
              alignItems: "start",
              paddingBottom: "12px",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                backgroundColor: "#eff6ff",
                color: "var(--primary, #28336e)",
                border: "1px solid #dbeafe",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              G1
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              <span style={{ fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>
                Total Sales
              </span>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Total Income/Sales including GST
              </span>
              <div>
                <span
                  style={{
                    fontSize: "10px",
                    fontFamily: "SFMono-Regular, Consolas, Monaco, monospace",
                    color: "#64748b",
                    marginTop: "4px",
                    display: "inline-block",
                    padding: "1px 6px",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    borderRadius: "4px",
                  }}
                >
                  G1 = Total Income + GST on Sales = {formatGst(totalIncomeVal)} + {formatGst(gstSales)}
                </span>
              </div>
            </div>
            <div
              style={{
                textAlign: "right",
                fontWeight: 700,
                fontSize: "15px",
                color: "#0f172a",
                whiteSpace: "nowrap",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatGst(totalSalesVal)}
            </div>
          </div>

          {/* Row 1A */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "56px 1fr 120px",
              alignItems: "start",
              paddingBottom: "12px",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                backgroundColor: "#fff7ed",
                color: "#ea580c",
                border: "1px solid #ffedd5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              1A
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              <span style={{ fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>
                GST on Sales
              </span>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                GST collected on Income/Sales
              </span>
            </div>
            <div
              style={{
                textAlign: "right",
                fontWeight: 700,
                fontSize: "15px",
                color: "#0f172a",
                whiteSpace: "nowrap",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatGst(gstSales)}
            </div>
          </div>

          {/* Row 1B */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "56px 1fr 120px",
              alignItems: "start",
              paddingBottom: "12px",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                backgroundColor: "#f0fdf4",
                color: "#16a34a",
                border: "1px solid #dcfce7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              1B
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              <span style={{ fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>
                GST on Purchases
              </span>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                GST paid on Expenses/Purchases
              </span>
            </div>
            <div
              style={{
                textAlign: "right",
                fontWeight: 700,
                fontSize: "15px",
                color: "#0f172a",
                whiteSpace: "nowrap",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatGst(gstPurchases)}
            </div>
          </div>

          {/* Row 9 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "56px 1fr 120px",
              alignItems: "start",
              paddingBottom: "12px",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                backgroundColor: "#faf5ff",
                color: "#9333ea",
                border: "1px solid #f3e8ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              9
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              <span style={{ fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>
                Refund / Payment Due
              </span>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Net GST position (1A - 1B)
              </span>
            </div>
            <div
              style={{
                textAlign: "right",
                fontWeight: 700,
                fontSize: "15px",
                color: "#0f172a",
                whiteSpace: "nowrap",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatGst(Math.abs(refundOrPayment))}
            </div>
          </div>

          {/* Net position Outcome Card */}
          <div
            style={{
              background:
                refundOrPayment >= 0
                  ? "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)"
                  : "linear-gradient(135deg, #fff1f2 0%, #fff5f5 100%)",
              border:
                refundOrPayment >= 0 ? "1px solid #bbf7d0" : "1px solid #fecdd3",
              borderRadius: "12px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              boxShadow: "0 2px 4px -1px rgba(0, 0, 0, 0.01)",
              marginTop: "4px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {refundOrPayment >= 0 ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  style={{ width: "16px", height: "16px", color: "#16a34a" }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  style={{ width: "16px", height: "16px", color: "#dc2626" }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                  />
                </svg>
              )}
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "13px",
                  color: refundOrPayment >= 0 ? "#14532d" : "#7f1d1d",
                }}
              >
                {refundOrPayment >= 0 ? "Refund Due from ATO" : "Payment Due to ATO"}
              </span>
            </div>
            <span
              style={{
                fontSize: "11px",
                color: refundOrPayment >= 0 ? "#15803d" : "#b91c1c",
                fontWeight: 550,
              }}
            >
              {refundOrPayment >= 0
                ? `Formula: GST on Purchases - GST on Sales = ${formatGst(gstPurchases)} - ${formatGst(gstSales)}`
                : `Formula: GST on Sales - GST on Purchases = ${formatGst(gstSales)} - ${formatGst(gstPurchases)}`}
            </span>
            <span
              style={{
                fontSize: "28px",
                fontWeight: 800,
                color: refundOrPayment >= 0 ? "#16a34a" : "#dc2626",
                fontVariantNumeric: "tabular-nums",
                marginTop: "2px",
                letterSpacing: "-0.02em",
              }}
            >
              {formatGst(Math.abs(refundOrPayment))}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#f8fafc",
            borderBottomLeftRadius: "20px",
            borderBottomRightRadius: "20px",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: "11px",
              color: "#64748b",
              maxWidth: "62%",
              lineHeight: 1.4,
            }}
          >
            Accruals basis, dated by invoice date &mdash; cash-basis reporting will differ.
            Personal and rejected transactions are excluded.
          </span>
          <button
            type="button"
            onClick={handleExportGstCsv}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              border: "1.5px solid #1e293b",
              borderRadius: "8px",
              backgroundColor: "#ffffff",
              color: "#1e293b",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f1f5f9";
              e.currentTarget.style.borderColor = "#0f172a";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#ffffff";
              e.currentTarget.style.borderColor = "#1e293b";
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{ width: "14px", height: "14px" }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
