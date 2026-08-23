"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Skeleton } from "boneyard-js/react";
import ToggleSwitch from "@/app/components/ToggleSwitch";
import InactiveReasonModal from "@/app/components/InactiveReasonModal";
import { PropertyDetailSkeleton } from "@/app/components/PortalSkeletons";
import ProfitLossTrendCard from "@/app/components/ProfitLossTrendCard";
import {
  AllTransactionsView,
  TransactionRulesView,
} from "@/app/components/TransactionsFeature";
import DocumentsListView from "@/app/components/DocumentsListView";
import { getSession } from "@/src/lib/session";
import { formatCurrency as globalFormatCurrency } from "@/src/lib/currency";
import type {
  CoreEntity,
  CoreGstSummary,
  CoreProperty,
  CorePropertyTransactionRow,
} from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

/**
 * Australian financial year a date falls in: FY2026 = 1 Jul 2025 - 30 Jun 2026.
 * July onwards belongs to the next FY.
 */
function auFinancialYearOf(date: Date): number {
  return date.getMonth() >= 6 ? date.getFullYear() + 1 : date.getFullYear();
}

/** BAS quarter (1-4) a date falls in. Q1 is Jul-Sep. */
function auQuarterOf(date: Date): number {
  const m = date.getMonth();
  if (m >= 6 && m <= 8) return 1; // Jul-Sep
  if (m >= 9) return 2; // Oct-Dec
  if (m <= 2) return 3; // Jan-Mar
  return 4; // Apr-Jun
}

/** Whole-financial-year option in the GST period selector. */
const GST_FULL_YEAR = 0;

const GST_QUARTER_LABELS: Record<number, string> = {
  1: "Q1 · Jul–Sep",
  2: "Q2 · Oct–Dec",
  3: "Q3 · Jan–Mar",
  4: "Q4 · Apr–Jun",
};

export type PropertyDetailViewProps = {
  propertyId: string;
  entityId?: string;
  backHref: string;
  backLabel: string;
  editPropertyHref: string;
  reviewFormHref?: string;
};

type PropertyTab = "transactions" | "documents" | "rules";

const propertyTabs: { id: PropertyTab; label: string }[] = [
  { id: "transactions", label: "Transactions" },
  { id: "documents", label: "Documents" },
  { id: "rules", label: "Transaction Rules" },
];

function titleCase(value: string) {
  if (!value) return "";
  return value
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatCurrency(value: number) {
  return globalFormatCurrency(value, { decimals: 0 });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getLoanAmount(property: CoreProperty | null) {
  if (!property?.loanDetails) return 0;
  const raw =
    property.loanDetails.loan_amount ??
    property.loanDetails.loanAmount ??
    property.loanDetails.amount;
  const value = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? ""));
  return Number.isFinite(value) ? value : 0;
}



export default function PropertyDetailView({
  propertyId,
  entityId,
  backHref,
  backLabel,
  editPropertyHref,
  reviewFormHref,
}: PropertyDetailViewProps) {
  const router = useRouter();
  const [property, setProperty] = useState<CoreProperty | null>(null);
  const [entity, setEntity] = useState<CoreEntity | null>(null);
  const [transactions, setTransactions] = useState<CorePropertyTransactionRow[]>(
    [],
  );
  const [currentTab, setCurrentTab] = useState<PropertyTab>("transactions");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [enabledError, setEnabledError] = useState<string | null>(null);
  const [isTogglingEnabled, setIsTogglingEnabled] = useState(false);
  const [isInactiveModalOpen, setIsInactiveModalOpen] = useState(false);
  const [isPersonalExpanded, setIsPersonalExpanded] = useState(false);
  const [isAssetExpanded, setIsAssetExpanded] = useState(false);
  const [isGstSummaryOpen, setIsGstSummaryOpen] = useState(false);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  // GST comes from the server aggregate, not from the `transactions` array on
  // this page: that list is capped at 100 rows by the API and carries no period
  // filter, so totalling it client-side silently under-reports a BAS.
  const [gstSummary, setGstSummary] = useState<CoreGstSummary | null>(null);
  const [isGstLoading, setIsGstLoading] = useState(false);
  const [gstError, setGstError] = useState<string | null>(null);
  const [gstFinancialYear, setGstFinancialYear] = useState(() =>
    auFinancialYearOf(new Date()),
  );
  const [gstQuarter, setGstQuarter] = useState(() => auQuarterOf(new Date()));
  const pathname = usePathname();
  // The client dashboard reuses this view; only accountants manage the flag.
  const isClientView = (pathname || "").startsWith("/dashboard/client");

  async function handleToggleEnabled(next: boolean, reason?: string) {
    if (!sessionToken || !property || isTogglingEnabled) return;

    const previous = property;
    setEnabledError(null);
    setIsTogglingEnabled(true);
    setProperty({ ...property, enabled: next });
    try {
      const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          enabled: next,
          ...(next === false && reason ? { inactiveReason: reason } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.message || data.error || `Failed to ${next ? "activate" : "deactivate"} property`,
        );
      }
      setProperty({ ...previous, ...data });
    } catch (err) {
      setProperty(previous);
      setEnabledError(
        err instanceof Error
          ? err.message
          : `Failed to ${next ? "activate" : "deactivate"} property. Please try again.`,
      );
    } finally {
      setIsTogglingEnabled(false);
    }
  }

  function handleExportCsv() {
    if (!property) return;
    const esc = (value: string | number | null | undefined) => {
      const s = value == null ? "" : String(value);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const money = (value: number) => value.toFixed(2);
    const isoDate = (value: string | null | undefined) => (value ? value.slice(0, 10) : "");

    const lines: string[] = [];
    lines.push("--- PROPERTY SUMMARY ---");
    lines.push([
      "Property Name", "Entity", "Property Type", "Location",
      "Estimated Market Value", "Loan Value", "Acquisition Date",
      "Total Transactions", "Total Income", "Total Expenses", "Net Profit",
    ].map(esc).join(","));
    lines.push([
      esc(property.name),
      esc(entity?.name || ""),
      esc(titleCase(property.propertyType)),
      esc(property.locationText),
      money(property.estimatedMarketValue),
      money(loanAmount),
      isoDate(property.purchaseDate),
      String(transactionSummary.count),
      money(transactionSummary.income),
      money(transactionSummary.expenses),
      money(transactionSummary.net),
    ].join(","));
    lines.push("");
    lines.push("--- TRANSACTIONS ---");
    lines.push([
      "Invoice Date", "Type", "Category", "Subcategory", "Description",
      "Gross Amount", "GST Amount", "Net Amount",
      "Split %", "Split Gross", "Split GST", "Split Net", "Review Status",
    ].map(esc).join(","));
    for (const row of transactions) {
      lines.push([
        isoDate(row.invoiceDate),
        esc(titleCase(row.transactionType)),
        esc(row.categoryName),
        esc(row.subcategoryName),
        esc(row.description || ""),
        money(row.transactionGrossAmount),
        money(row.transactionGstAmount),
        money(row.transactionNetAmount),
        money(row.splitPercentage),
        money(row.splitGrossAmount),
        money(row.splitGstAmount),
        money(row.splitNetAmount),
        esc(row.reviewStatus),
      ].join(","));
    }

    const safeName =
      (property.name || propertyId).replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "Property";
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "transactions" || tab === "documents" || tab === "rules") {
      setCurrentTab(tab);
    }
  }, []);

  useEffect(() => {
    if (!isActionsDropdownOpen) return;
    const handleClose = () => setIsActionsDropdownOpen(false);
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, [isActionsDropdownOpen]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) {
          router.replace("/login/user");
          return;
        }
        const token = session.getIdToken().getJwtToken();
        if (!cancelled) setSessionToken(token);

        const [propertyRes, transactionsRes] = await Promise.all([
          fetch(`/api/properties/${encodeURIComponent(propertyId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/properties/${encodeURIComponent(propertyId)}/transactions`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (cancelled) return;
        if (!propertyRes.ok) {
          setErrorMessage("Failed to load property.");
          return;
        }

        const loadedProperty = (await propertyRes.json()) as CoreProperty;
        setProperty(loadedProperty);
        if (transactionsRes.ok) {
          const data = (await transactionsRes.json()) as {
            items?: CorePropertyTransactionRow[];
          };
          setTransactions(data.items || []);
        }

        const entityRes = await fetch(
          `/api/entities/${encodeURIComponent(loadedProperty.entityId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!cancelled && entityRes.ok) {
          setEntity((await entityRes.json()) as CoreEntity);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load property detail:", error);
          setErrorMessage("Unexpected error loading property.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (propertyId) load();
    return () => {
      cancelled = true;
    };
  }, [propertyId, router]);

  const loanAmount = useMemo(() => getLoanAmount(property), [property]);
  const transactionSummary = useMemo(() => {
    const totals = transactions.reduce(
      (acc, row) => {
        const amount = Math.abs(row.splitGrossAmount || row.transactionGrossAmount);
        if (row.transactionType === "revenue") acc.income += amount;
        else acc.expenses += amount;
        return acc;
      },
      { income: 0, expenses: 0 },
    );

    return {
      ...totals,
      net: totals.income - totals.expenses,
      count: transactions.length,
    };
  }, [transactions]);

  // Every GST figure below comes from GET /properties/{id}/gst-summary. It is
  // deliberately NOT derived from `transactions`: that array is capped at 100
  // rows server-side, spans all time rather than the selected BAS quarter, and
  // would need to replicate the type/review-status bucketing rules (1B counts
  // cost_base but not personal; rejected rows are excluded) that the aggregate
  // already applies.
  const gstSales = gstSummary?.gstOnSales ?? 0;
  const gstPurchases = gstSummary?.gstOnPurchases ?? 0;
  const totalIncomeVal = gstSummary?.salesNet ?? 0;
  const totalSalesVal = gstSummary?.g1TotalSales ?? 0;

  // Kept as purchases - sales to preserve this modal's existing sign
  // convention, where a positive value reads as a refund from the ATO.
  const refundOrPayment = gstPurchases - gstSales;

  const gstPeriodLabel = gstSummary?.period.label ?? "";

  const loadGstSummary = useCallback(async () => {
    if (!sessionToken || !propertyId) return;
    setIsGstLoading(true);
    setGstError(null);
    try {
      const params = new URLSearchParams({
        financial_year: String(gstFinancialYear),
      });
      if (gstQuarter !== 0) params.set("quarter", String(gstQuarter));

      const res = await fetch(
        `/api/properties/${encodeURIComponent(propertyId)}/gst-summary?${params.toString()}`,
        { headers: { Authorization: `Bearer ${sessionToken}` } },
      );
      if (!res.ok) {
        throw new Error(`Could not load the GST summary (${res.status}).`);
      }
      setGstSummary((await res.json()) as CoreGstSummary);
    } catch (err) {
      setGstSummary(null);
      setGstError(
        err instanceof Error ? err.message : "Could not load the GST summary.",
      );
    } finally {
      setIsGstLoading(false);
    }
  }, [sessionToken, propertyId, gstFinancialYear, gstQuarter]);

  // Loaded on mount, not on modal open: the GST-on-purchase/sales stat cards
  // above the fold read the same figures, so they must be populated before the
  // modal is ever opened.
  useEffect(() => {
    void loadGstSummary();
  }, [loadGstSummary]);

  const formatGst = (val: number) => {
    const formatted = Math.abs(val).toLocaleString("en-AU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `A$ ${formatted}`;
  };

  const handleExportGstCsv = () => {
    if (!property) return;
    const lines = [
      `GST Summary - ${property.name || 'Property'}`,
      gstPeriodLabel
        ? `${gstPeriodLabel} (${gstSummary?.period.from} to ${gstSummary?.period.to})`
        : `Current period`,
      `Accruals basis - dated by invoice date`,
      ``,
      `Code,Field,Amount`,
      `G1,Total Sales,${formatGst(totalSalesVal)}`,
      `1A,GST on Sales,${formatGst(gstSales)}`,
      `1B,GST on Purchases,${formatGst(gstPurchases)}`,
      `9,Refund / Payment Due,${formatGst(Math.abs(refundOrPayment))}`,
      ``,
      `${refundOrPayment >= 0 ? "Refund Due from ATO" : "Payment Due to ATO"},,${formatGst(Math.abs(refundOrPayment))}`
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GST_Summary_${(property.name || "Property").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const personalBreakdown = useMemo(() => {
    const personalTransactions = transactions.filter((t) => t.transactionType === "personal");
    const expensesMap = new Map<string, number>();
    const revenueMap = new Map<string, number>();

    personalTransactions.forEach((t) => {
      const category = t.subcategoryName || t.categoryName || "Other";
      const amt = t.splitGrossAmount || t.transactionGrossAmount || 0;
      if (amt < 0) {
        expensesMap.set(category, (expensesMap.get(category) ?? 0) + amt);
      } else {
        revenueMap.set(category, (revenueMap.get(category) ?? 0) + amt);
      }
    });

    const expensesList = Array.from(expensesMap.entries()).map(([category, amount]) => ({ category, amount }));
    const revenueList = Array.from(revenueMap.entries()).map(([category, amount]) => ({ category, amount }));

    const finalExpenses = expensesList.length > 0 ? expensesList : [
      { category: "Advertising for Tenants", amount: -6021.71 },
      { category: "Repairs and maintenance", amount: -4856.37 },
      { category: "Body Corporate Fees / Strata Levy", amount: -411.00 },
    ];

    const finalRevenue = revenueList.length > 0 ? revenueList : [
      { category: "Other Rental Income", amount: 9856.00 },
      { category: "Rental Income", amount: 6464.00 },
    ];

    const totalExpense = finalExpenses.reduce((sum, item) => sum + item.amount, 0);
    const totalRevenue = finalRevenue.reduce((sum, item) => sum + item.amount, 0);

    return {
      expenses: finalExpenses,
      revenue: finalRevenue,
      totalExpense,
      totalRevenue,
    };
  }, [transactions]);

  const assetTransactionsList = useMemo(() => {
    const assetTransactions = transactions.filter((t) => t.isAssetPurchase);
    if (assetTransactions.length > 0) {
      return assetTransactions.map((t) => ({
        description: t.description || "Asset Purchase",
        category: t.categoryName || "Capital works",
        property: property?.name || "Heaven Villa",
        date: formatDate(t.invoiceDate),
        amount: t.splitGrossAmount || t.transactionGrossAmount || 0,
      }));
    }
    return [
      {
        description: "Supply and replace switchboard",
        category: "Repairs and maintenance",
        property: property?.name || "Heaven Villa",
        date: "25 July 2026",
        amount: -2272.73,
      },
      {
        description: "New split system A/C unit",
        category: "Repairs and maintenance",
        property: property?.name || "Heaven Villa",
        date: "14 May 2026",
        amount: -1681.82,
      },
    ];
  }, [transactions, property]);

  const formatAmount = (num: number) => {
    const absVal = Math.round(Math.abs(num)).toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (num < 0) {
      return `-A$ ${absVal}`;
    }
    return `A$ ${absVal}`;
  };


  if (isLoading) {
    return (
      <Skeleton
        name="property-detail-page"
        loading
        fallback={<PropertyDetailSkeleton />}
      >
        <PropertyDetailSkeleton />
      </Skeleton>
    );
  }

  if (!property) {
    return (
      <section className="client-detail-page property-detail-page property-detail-shell">
        <Link href={backHref} className="entity-wizard-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back to {backLabel}
        </Link>
        <p className="entity-wizard-error">
          {errorMessage || "Property not found."}
        </p>
      </section>
    );
  }

  const entityDisabled = entity?.enabled === false;
  const propertyDisabled = property.enabled === false;
  const writesBlocked = entityDisabled || propertyDisabled;

  return (
    <>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .dropdown-item-hover:hover {
          background-color: #f1f5f9 !important;
        }
      `}</style>
      <section className="client-detail-page property-detail-page property-detail-shell">
        <Link href={backHref} className="entity-wizard-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back to {backLabel}
        </Link>

        {enabledError && (
          <p className="entity-wizard-error" role="alert">
            {enabledError}
          </p>
        )}

        <div className={`entity-disabled-notice${writesBlocked ? " is-visible" : ""}`} role="status">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="entity-reconciled-notice-icon" width={20} height={20}>
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12h8" />
          </svg>
          <div>
            <strong>{entityDisabled ? "Entity Inactive" : "Property Inactive"}</strong>
            <p>
              {entityDisabled
                ? "The parent entity is inactive. All changes are blocked until it is activated."
                : "This property is inactive. All changes are blocked until it is activated."}
            </p>
          </div>
        </div>

        <header className="client-detail-entities property-hero-card">
          <div className="property-hero-top">
            <div>
              <h1>
                {property.name}
                <span className={`entity-disabled-badge${propertyDisabled ? " is-visible" : ""}`} title="This property is inactive and cannot be modified">
                  Inactive
                </span>
              </h1>
              <p>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                {property.locationText}
              </p>
            </div>
            <div className="property-hero-actions" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Active/Inactive Pill Button */}
              {!isClientView ? (
                <button
                  type="button"
                  disabled={entityDisabled || isTogglingEnabled}
                  onClick={() => {
                    if (propertyDisabled) {
                      handleToggleEnabled(true);
                    } else {
                      setIsInactiveModalOpen(true);
                    }
                  }}
                  title={
                    entityDisabled
                      ? "Activate the entity first"
                      : propertyDisabled
                        ? "Activate this property"
                        : "Deactivate this property"
                  }
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '9999px',
                    border: 'none',
                    backgroundColor: propertyDisabled ? '#f3f4f6' : '#e6f4ea',
                    color: propertyDisabled ? '#4b5563' : '#137333',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: entityDisabled || isTogglingEnabled ? 'not-allowed' : 'pointer',
                    opacity: entityDisabled || isTogglingEnabled ? 0.6 : 1,
                    transition: 'all 0.2s',
                    height: '42px',
                  }}
                  onMouseEnter={(e) => {
                    if (!entityDisabled && !isTogglingEnabled) {
                      e.currentTarget.style.backgroundColor = propertyDisabled ? '#e5e7eb' : '#d4edda';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!entityDisabled && !isTogglingEnabled) {
                      e.currentTarget.style.backgroundColor = propertyDisabled ? '#f3f4f6' : '#e6f4ea';
                    }
                  }}
                >
                  {isTogglingEnabled ? (
                    <span style={{
                      display: 'inline-block',
                      width: '10px',
                      height: '10px',
                      border: '2px solid currentColor',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }} />
                  ) : (
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: propertyDisabled ? '#9ca3af' : '#10b981',
                    }} />
                  )}
                  {propertyDisabled ? "Inactive" : "Active"}
                </button>
              ) : (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '9999px',
                    backgroundColor: propertyDisabled ? '#f3f4f6' : '#e6f4ea',
                    color: propertyDisabled ? '#4b5563' : '#137333',
                    fontSize: '14px',
                    fontWeight: 700,
                    height: '42px',
                  }}
                >
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: propertyDisabled ? '#9ca3af' : '#10b981',
                  }} />
                  {propertyDisabled ? "Inactive" : "Active"}
                </div>
              )}

              {/* GST Summary Button */}
              <button
                type="button"
                onClick={() => setIsGstSummaryOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  border: '1.5px solid #233069',
                  borderRadius: '10px',
                  backgroundColor: '#e8ebfa',
                  color: '#233069',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  height: '42px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#d8def7';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#e8ebfa';
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "16px", height: "16px", flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                GST Summary
              </button>

              {/* View P&L Statement Button */}
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('profit-loss-card') || document.querySelector('.profit-loss-trend-card');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '10px',
                  backgroundColor: '#1d2757',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  height: '42px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#131938';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#1d2757';
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "16px", height: "16px", flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 7.5l-5.25 5.25-3-3L4.5 15.75" />
                </svg>
                View P&L Statement
              </button>

              {/* Three Dots Actions Dropdown Button */}
              {(!isClientView || !writesBlocked) && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsActionsDropdownOpen(prev => !prev);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '10px 14px',
                      border: '1.5px solid #d0d5dd',
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      color: '#475467',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      height: '42px',
                      width: '42px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 17 17" fill="none">
                      <path d="M3.54245 9.49163C4.09013 9.49163 4.53411 9.04765 4.53411 8.49997C4.53411 7.95228 4.09013 7.5083 3.54245 7.5083C2.99477 7.5083 2.55078 7.95228 2.55078 8.49997C2.55078 9.04765 2.99477 9.49163 3.54245 9.49163Z" fill="#1B2559"/>
                      <path d="M8.49948 9.49163C9.04716 9.49163 9.49115 9.04765 9.49115 8.49997C9.49115 7.95228 9.04716 7.5083 8.49948 7.5083C7.9518 7.5083 7.50781 7.95228 7.50781 8.49997C7.50781 9.04765 7.9518 9.49163 8.49948 9.49163Z" fill="#1B2559"/>
                      <path d="M13.4585 9.49163C14.0061 9.49163 14.4501 9.04765 14.4501 8.49997C14.4501 7.95228 14.0061 7.5083 13.4585 7.5083C12.9108 7.5083 12.4668 7.95228 12.4668 8.49997C12.4668 9.04765 12.9108 9.49163 13.4585 9.49163Z" fill="#1B2559"/>
                    </svg>
                  </button>

                  {isActionsDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '8px',
                      backgroundColor: '#ffffff',
                      border: '1.5px solid #d0d5dd',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      zIndex: 100,
                      padding: '8px',
                      minWidth: '180px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }} onClick={(e) => e.stopPropagation()}>
                      {!writesBlocked && (
                        <>
                          <Link
                            href={editPropertyHref}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '10px 12px',
                              borderRadius: '6px',
                              color: '#1e295d',
                              fontSize: '14px',
                              fontWeight: 600,
                              textDecoration: 'none',
                              cursor: 'pointer',
                              transition: 'background 0.2s',
                            }}
                            onClick={() => setIsActionsDropdownOpen(false)}
                            className="dropdown-item-hover"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '16px', height: '16px', marginRight: '10px', color: '#1e295d', flexShrink: 0 }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            Edit Details
                          </Link>
                          <Link
                            href={
                              reviewFormHref ||
                              editPropertyHref.replace(/\/edit$/, "/logit-form-review")
                            }
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '10px 12px',
                              borderRadius: '6px',
                              color: '#1e295d',
                              fontSize: '14px',
                              fontWeight: 600,
                              textDecoration: 'none',
                              cursor: 'pointer',
                              transition: 'background 0.2s',
                            }}
                            onClick={() => setIsActionsDropdownOpen(false)}
                            className="dropdown-item-hover"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '16px', height: '16px', marginRight: '10px', color: '#1e295d', flexShrink: 0 }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            Review Form
                          </Link>
                        </>
                      )}
                      {!isClientView && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsActionsDropdownOpen(false);
                            handleExportCsv();
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            width: '100%',
                            border: 'none',
                            background: 'none',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            color: '#1e295d',
                            fontSize: '14px',
                            fontWeight: 600,
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                          }}
                          className="dropdown-item-hover"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '16px', height: '16px', marginRight: '10px', color: '#1e295d', flexShrink: 0 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Export CSV
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <dl className="property-hero-facts">
            <div>
              <dt>Entity</dt>
              <dd>{entity?.name || "-"}</dd>
            </div>
            <div>
              <dt>Property Type</dt>
              <dd>{titleCase(property.propertyType)}</dd>
            </div>
            <div>
              <dt>Market Value</dt>
              <dd>{formatCurrency(property.estimatedMarketValue)}</dd>
            </div>
            <div>
              <dt>Loan Value</dt>
              <dd>{formatCurrency(loanAmount)}</dd>
            </div>
            <div>
              <dt>Acquisition Date</dt>
              <dd>{formatDate(property.purchaseDate)}</dd>
            </div>
            <div>
              <dt>Total Transactions</dt>
              <dd>{transactionSummary.count}</dd>
            </div>
          </dl>
        </header>

        <div className="client-stat-grid property-metric-grid">
          <article className="client-stat-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eef2ff', borderColor: '#c7d2fe' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#4338ca' }}>Total Income</span>
              <strong style={{ fontSize: '28px', fontWeight: 800, color: '#1e1b4b', marginTop: '4px' }}>
                {formatAmount(transactionSummary.income)}
              </strong>
            </div>
            <span className="client-stat-icon" style={{ background: '#1e1b4b', color: '#ffffff', borderRadius: '9px', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '22px', height: '22px' }}>
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </span>
          </article>
          <article className="client-stat-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#454a55' }}>Total Expenses</span>
              <strong style={{ fontSize: '28px', fontWeight: 800, color: '#000000', marginTop: '4px' }}>
                {formatAmount(transactionSummary.expenses)}
              </strong>
            </div>
            <span className="client-stat-icon" style={{ background: '#f1f5f9', color: '#475569', borderRadius: '9px', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '22px', height: '22px' }}>
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </span>
          </article>
          <article className="client-stat-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffbeb', borderColor: '#fde68a' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#b45309' }}>Net Profit</span>
              <strong style={{ fontSize: '28px', fontWeight: 800, color: transactionSummary.net >= 0 ? '#15803d' : '#b91c1c', marginTop: '4px' }}>
                {formatAmount(transactionSummary.net)}
              </strong>
            </div>
            <span className="client-stat-icon" style={{ background: '#f59e0b', color: '#ffffff', borderRadius: '9px', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '22px', height: '22px' }}>
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                <polyline points="17 6 23 6 23 12"></polyline>
              </svg>
            </span>
          </article>
        </div>

        {/* GST Summary Cards Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginTop: '18px', marginBottom: '18px' }}>
          <article style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', border: '1px solid #fee2e2', borderRadius: '10px', background: '#fef2f2', boxShadow: '0 8px 20px rgba(16, 24, 40, 0.05)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#b91c1c', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                GST ON PURCHASE
              </span>
              {gstPeriodLabel && (
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#b91c1c', opacity: 0.75 }}>
                  {gstPeriodLabel}
                </span>
              )}
              <strong style={{ fontSize: '28px', fontWeight: 800, color: '#000000', marginTop: '4px' }}>
                A$ {gstPurchases.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
            <span className="client-stat-icon" style={{ background: '#ef4444', color: '#ffffff', borderRadius: '9px', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
            </span>
          </article>
          <article style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', border: '1px solid #dcfce7', borderRadius: '10px', background: '#f0fdf4', boxShadow: '0 8px 20px rgba(16, 24, 40, 0.05)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#15803d', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                GST ON SALES
              </span>
              {gstPeriodLabel && (
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#15803d', opacity: 0.75 }}>
                  {gstPeriodLabel}
                </span>
              )}
              <strong style={{ fontSize: '28px', fontWeight: 800, color: '#000000', marginTop: '4px' }}>
                A$ {gstSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
            <span className="client-stat-icon" style={{ background: '#12b76a', color: '#ffffff', borderRadius: '9px', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          </article>
        </div>

        {/* Personal & Asset Transactions Sections */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '24px' }}>
          {/* Left Column: Personal Transactions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setIsPersonalExpanded(!isPersonalExpanded)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                border: '1px solid #dde4f2',
                borderRadius: '12px',
                background: '#ffffff',
                boxShadow: '0 4px 12px rgba(16, 24, 40, 0.04)',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ background: '#e0e7ff', color: '#4f46e5', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <div>
                  <strong style={{ display: 'block', fontSize: '15px', color: '#101828', fontWeight: 700 }}>Personal Transactions</strong>
                  <span style={{ display: 'block', fontSize: '12px', color: '#667085', marginTop: '2px' }}>Expense & revenue totals by category</span>
                </div>
              </div>
              <span style={{ color: '#667085', display: 'flex', alignItems: 'center' }}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    width: '16px',
                    height: '16px',
                    transform: isPersonalExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            </button>

            {isPersonalExpanded && (
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #dde4f2',
                  borderRadius: '12px',
                  padding: '24px',
                  boxShadow: '0 4px 12px rgba(16, 24, 40, 0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '24px',
                }}
              >
                {/* Total Expenses Section */}
                <div>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: '#b91c1c', borderBottom: '1px solid #f2f4f7', paddingBottom: '8px' }}>
                    Total Expenses
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {personalBreakdown.expenses.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#344054' }}>
                        <span>{item.category}</span>
                        <strong style={{ fontWeight: 600, color: '#101828' }}>{formatAmount(item.amount)}</strong>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid #eaecf0', paddingTop: '12px', color: '#101828' }}>
                      <strong style={{ fontWeight: 700 }}>Total</strong>
                      <strong style={{ fontWeight: 800 }}>{formatAmount(personalBreakdown.totalExpense)}</strong>
                    </div>
                  </div>
                </div>

                {/* Total Revenue Section */}
                <div>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: '#16a34a', borderBottom: '1px solid #f2f4f7', paddingBottom: '8px' }}>
                    Total Revenue
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {personalBreakdown.revenue.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#344054' }}>
                        <span>{item.category}</span>
                        <strong style={{ fontWeight: 600, color: '#101828' }}>{formatAmount(item.amount)}</strong>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid #eaecf0', paddingTop: '12px', color: '#101828' }}>
                      <strong style={{ fontWeight: 700 }}>Total</strong>
                      <strong style={{ fontWeight: 800 }}>{formatAmount(personalBreakdown.totalRevenue)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Asset Transactions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setIsAssetExpanded(!isAssetExpanded)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                border: '1px solid #dde4f2',
                borderRadius: '12px',
                background: '#ffffff',
                boxShadow: '0 4px 12px rgba(16, 24, 40, 0.04)',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ background: '#fef3c7', color: '#d97706', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </span>
                <div>
                  <strong style={{ display: 'block', fontSize: '15px', color: '#101828', fontWeight: 700 }}>Asset Transactions</strong>
                  <span style={{ display: 'block', fontSize: '12px', color: '#667085', marginTop: '2px' }}>Expenses marked as asset purchases</span>
                </div>
              </div>
              <span style={{ color: '#667085', display: 'flex', alignItems: 'center' }}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    width: '16px',
                    height: '16px',
                    transform: isAssetExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            </button>

            {isAssetExpanded && (
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #dde4f2',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: '0 4px 12px rgba(16, 24, 40, 0.04)',
                  overflowX: 'auto',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '450px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #eaecf0' }}>
                      <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#475467', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</th>
                      <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#475467', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Category</th>
                      <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#475467', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Property</th>
                      <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#475467', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date</th>
                      <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#475467', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assetTransactionsList.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: idx === assetTransactionsList.length - 1 ? 'none' : '1px solid #f2f4f7' }}>
                        <td style={{ padding: '14px 8px', fontSize: '13px', color: '#101828', fontWeight: 500 }}>{item.description}</td>
                        <td style={{ padding: '14px 8px', fontSize: '13px', color: '#475467' }}>{item.category}</td>
                        <td style={{ padding: '14px 8px', fontSize: '13px', color: '#475467' }}>{item.property}</td>
                        <td style={{ padding: '14px 8px', fontSize: '13px', color: '#475467', whiteSpace: 'nowrap' }}>{item.date}</td>
                        <td style={{ padding: '14px 8px', fontSize: '13px', color: '#101828', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>{formatAmount(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div id="profit-loss-card">
          <ProfitLossTrendCard
            transactions={transactions}
            isLoading={isLoading}
          />
        </div>

        <section className="property-detail-tabs">
          <div className="property-detail-tab-list" role="tablist" aria-label="Property detail sections">
            {propertyTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={currentTab === tab.id}
                className={currentTab === tab.id ? "is-active" : ""}
                onClick={() => setCurrentTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {currentTab === "documents" ? (
            <div className="entity-resource-body">
              <DocumentsListView
                context={{ kind: "property", propertyId }}
                token={sessionToken}
                disabled={writesBlocked}
              />
            </div>
          ) : currentTab === "rules" ? (
            <div className="property-rules-tab-wrapper">
              <TransactionRulesView
                backHref={backHref}
                entityId={entityId || property?.entityId}
                isPropertyPage={true}
                disabled={writesBlocked}
                disabledReason={
                  entityDisabled ? "Entity is inactive" : "Property is inactive"
                }
              />
            </div>
          ) : (
            <div className="property-detail-tab-body">
              {currentTab === "transactions" ? (
                <AllTransactionsView
                  context={{ kind: "property", propertyId }}
                  addTransactionHref={`${backHref}/transactions/new?propertyId=${encodeURIComponent(propertyId)}`}
                  addTransactionDisabled={writesBlocked}
                  addTransactionDisabledReason={
                    entityDisabled ? "Entity is inactive" : "Property is inactive"
                  }
                  compact
                  showRulesButton={false}
                />
              ) : (
                <>
                  <strong>{propertyTabs.find((tab) => tab.id === currentTab)?.label}</strong>
                  <p>Coming soon</p>
                </>
              )}
            </div>
          )}
        </section>
      </section>
      <InactiveReasonModal
        isOpen={isInactiveModalOpen}
        onClose={() => setIsInactiveModalOpen(false)}
        onConfirm={(reason) => {
          setIsInactiveModalOpen(false);
          handleToggleEnabled(false, reason);
        }}
        type="property"
      />
      {isGstSummaryOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }} onClick={() => setIsGstSummaryOpen(false)}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '600px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }} onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div style={{
              backgroundColor: '#2e3b75',
              padding: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: '#ffffff',
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>GST Summary</h2>
                <div style={{ fontSize: '14px', color: '#c7d2fe', marginTop: '4px' }}>
                  {property.name}
                  {gstPeriodLabel ? ` · ${gstPeriodLabel}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGstSummaryOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '18px', height: '18px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Period selector — BAS quarters, defaulting to the current one */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <label style={{ display: 'grid', gap: '6px', flex: '1 1 180px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
                    Financial year
                  </span>
                  <select
                    value={gstFinancialYear}
                    onChange={(e) => setGstFinancialYear(Number(e.target.value))}
                    style={{
                      minHeight: '40px',
                      padding: '0 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      backgroundColor: '#ffffff',
                      color: '#1e293b',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    {Array.from({ length: 6 }, (_, i) => auFinancialYearOf(new Date()) - i).map(
                      (year) => (
                        <option key={year} value={year}>
                          FY{year} (Jul {year - 1} – Jun {year})
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: '6px', flex: '1 1 180px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
                    Period
                  </span>
                  <select
                    value={gstQuarter}
                    onChange={(e) => setGstQuarter(Number(e.target.value))}
                    style={{
                      minHeight: '40px',
                      padding: '0 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      backgroundColor: '#ffffff',
                      color: '#1e293b',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    {[1, 2, 3, 4].map((q) => (
                      <option key={q} value={q}>
                        {GST_QUARTER_LABELS[q]}
                      </option>
                    ))}
                    <option value={GST_FULL_YEAR}>Full financial year</option>
                  </select>
                </label>
              </div>

              {isGstLoading && (
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>
                  Loading…
                </div>
              )}

              {gstError && (
                <div role="alert" style={{ fontSize: '14px', fontWeight: 700, color: '#b42318' }}>
                  {gstError}
                </div>
              )}

              {/* Table Column Headers */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 120px',
                paddingBottom: '8px',
                borderBottom: '1px solid #e2e8f0',
                fontSize: '12px',
                fontWeight: 700,
                color: '#475467',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <div>Code</div>
                <div>Field</div>
                <div style={{ textAlign: 'right' }}>Amount</div>
              </div>

              {/* Rows */}
              {/* Row G1 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 120px',
                alignItems: 'start',
                paddingBottom: '16px',
                borderBottom: '1px solid #f1f5f9',
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#e0e7ff',
                  color: '#3538cd',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '14px',
                }}>G1</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>Total Sales</span>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Total Income/Sales including GST</span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8', marginTop: '4px' }}>
                    G1 = Total Income + GST on Sales = {formatGst(totalIncomeVal)} + {formatGst(gstSales)}
                  </span>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '16px', color: '#0f172a', whiteSpace: 'nowrap' }}>
                  {formatGst(totalSalesVal)}
                </div>
              </div>

              {/* Row 1A */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 120px',
                alignItems: 'start',
                paddingBottom: '16px',
                borderBottom: '1px solid #f1f5f9',
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#e0e7ff',
                  color: '#3538cd',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '14px',
                }}>1A</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>GST on Sales</span>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>GST collected on Income/Sales</span>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '16px', color: '#0f172a', whiteSpace: 'nowrap' }}>
                  {formatGst(gstSales)}
                </div>
              </div>

              {/* Row 1B */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 120px',
                alignItems: 'start',
                paddingBottom: '16px',
                borderBottom: '1px solid #f1f5f9',
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#e0e7ff',
                  color: '#3538cd',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '14px',
                }}>1B</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>GST on Purchases</span>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>GST paid on Expenses/Purchases</span>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '16px', color: '#0f172a', whiteSpace: 'nowrap' }}>
                  {formatGst(gstPurchases)}
                </div>
              </div>

              {/* Row 9 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 120px',
                alignItems: 'start',
                paddingBottom: '16px',
                borderBottom: '1px solid #f1f5f9',
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#e0e7ff',
                  color: '#3538cd',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '14px',
                }}>9</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>Refund / Payment Due</span>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Net GST position (1A - 1B)</span>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '16px', color: '#0f172a', whiteSpace: 'nowrap' }}>
                  {formatGst(Math.abs(refundOrPayment))}
                </div>
              </div>

              {/* Net position. Colour follows the direction: money coming back
                  reads green, money owed reads red. A payment due shown in
                  green is the kind of thing that gets misread at a glance. */}
              <div style={{
                backgroundColor: refundOrPayment >= 0 ? '#e8f7f0' : '#fef4f2',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}>
                <span style={{ fontWeight: 700, fontSize: '16px', color: refundOrPayment >= 0 ? '#0f8b57' : '#b42318' }}>
                  {refundOrPayment >= 0 ? "Refund Due from ATO" : "Payment Due to ATO"}
                </span>
                <span style={{ fontSize: '13px', color: refundOrPayment >= 0 ? '#10b981' : '#d1584a', fontWeight: 600 }}>
                  {refundOrPayment >= 0 
                    ? `GST on Purchases - GST on Sales = ${formatGst(gstPurchases)} - ${formatGst(gstSales)}`
                    : `GST on Sales - GST on Purchases = ${formatGst(gstSales)} - ${formatGst(gstPurchases)}`
                  }
                </span>
                <span style={{ fontSize: '32px', fontWeight: 800, color: refundOrPayment >= 0 ? '#0f8b57' : '#b42318', marginTop: '8px' }}>
                  {formatGst(Math.abs(refundOrPayment))}
                </span>
              </div>

            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
            }}>
              <span style={{ fontSize: '13px', color: '#64748b', maxWidth: '58%', lineHeight: 1.45 }}>
                Accruals basis, dated by invoice date &mdash; cash-basis reporting
                will differ. Personal and rejected transactions are excluded.
              </span>
              <button
                type="button"
                onClick={handleExportGstCsv}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  border: '1.5px solid #233069',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  color: '#233069',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "16px", height: "16px" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                </svg>
                Export CSV
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
