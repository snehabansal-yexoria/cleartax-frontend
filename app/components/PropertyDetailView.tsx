"use client";

import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
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
import {
  assetItemName,
  personalCategoryLabel,
  useAssetTransactions,
  usePersonalSummary,
} from "@/app/components/usePersonalAndAssetTransactions";
import {
  pnlChangePct,
  pnlLineLabel,
  usePnlSummary,
} from "@/app/components/usePnlSummary";
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
  const params = useParams<{ clientId?: string }>();
  const clientId = params?.clientId ?? "";
  const [property, setProperty] = useState<CoreProperty | null>(null);
  const [entity, setEntity] = useState<CoreEntity | null>(null);
  const [transactions, setTransactions] = useState<CorePropertyTransactionRow[]>(
    [],
  );
  const [currentTab, setCurrentTab] = useState<PropertyTab>("transactions");
  const [isLoading, setIsLoading] = useState(true);
  const [showPnLStatement, setShowPnLStatement] = useState(false);
  const [pnlFinancialYear, setPnlFinancialYear] = useState(() => auFinancialYearOf(new Date()));
  const [compareWithPrevious, setCompareWithPrevious] = useState(false);
  const [isAddBalanceOpen, setIsAddBalanceOpen] = useState(false);
  const [isSubmittingBalance, setIsSubmittingBalance] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [addBalanceType, setAddBalanceType] = useState<"revenue" | "expense">("revenue");
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [subcategoriesList, setSubcategoriesList] = useState<any[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>("");
  const [selectedSubcatId, setSelectedSubcatId] = useState<string>("");
  const [balanceDate, setBalanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [balanceGross, setBalanceGross] = useState("");
  const [balanceGst, setBalanceGst] = useState("");
  const [balanceDesc, setBalanceDesc] = useState("");
  const [balanceError, setBalanceError] = useState("");
  const [contractDate, setContractDate] = useState("2026-08-15");
  const [settlementDate, setSettlementDate] = useState("2026-09-30");
  const [showCostBase, setShowCostBase] = useState(true);
  const [manualCostBaseRows, setManualCostBaseRows] = useState<Array<{ id: string; category: string; gross: string; net: string }>>([
    { id: "1", category: "Building & Pest Inspection", gross: "660", net: "600" },
    { id: "2", category: "Conveyancing Fees", gross: "1320", net: "1200" },
    { id: "3", category: "Loan Establishment Fee", gross: "600", net: "600" }
  ]);
  const [errorMessage, setErrorMessage] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [enabledError, setEnabledError] = useState<string | null>(null);
  const [isTogglingEnabled, setIsTogglingEnabled] = useState(false);
  const [isInactiveModalOpen, setIsInactiveModalOpen] = useState(false);
  const [isPersonalExpanded, setIsPersonalExpanded] = useState(false);
  const [isAssetExpanded, setIsAssetExpanded] = useState(false);
  const [isGstSummaryOpen, setIsGstSummaryOpen] = useState(false);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const [isFyDropdownOpen, setIsFyDropdownOpen] = useState(false);
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const borrowingCostHref = editPropertyHref.replace(/\/edit$/, "/borrowing-cost");
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
    if (!isFyDropdownOpen && !isPeriodDropdownOpen) return;
    const handleClose = () => {
      setIsFyDropdownOpen(false);
      setIsPeriodDropdownOpen(false);
    };
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, [isFyDropdownOpen, isPeriodDropdownOpen]);

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
  }, [propertyId, router, refreshTrigger]);

  // Load categories for Add Balance modal
  useEffect(() => {
    if (!isAddBalanceOpen || !sessionToken) return;

    let active = true;
    async function fetchCategories() {
      try {
        const res = await fetch(`/api/transactions/categories?type=${encodeURIComponent(addBalanceType)}`, {
          headers: { Authorization: `Bearer ${sessionToken}` }
        });
        if (res.ok && active) {
          const data = await res.json();
          setCategoriesList(data.items || []);
          setSelectedCatId("");
          setSubcategoriesList([]);
          setSelectedSubcatId("");
        }
      } catch (err) {
        console.error("Failed to load categories:", err);
      }
    }
    fetchCategories();
    return () => { active = false; };
  }, [isAddBalanceOpen, addBalanceType, sessionToken]);

  // Load subcategories for Add Balance modal
  useEffect(() => {
    if (!isAddBalanceOpen || !sessionToken || !selectedCatId) {
      setSubcategoriesList([]);
      setSelectedSubcatId("");
      return;
    }

    let active = true;
    async function fetchSubcategories() {
      try {
        const res = await fetch(`/api/transactions/categories/${encodeURIComponent(selectedCatId)}/sub-categories`, {
          headers: { Authorization: `Bearer ${sessionToken}` }
        });
        if (res.ok && active) {
          const data = await res.json();
          setSubcategoriesList(data.items || []);
          setSelectedSubcatId("");
        }
      } catch (err) {
        console.error("Failed to load subcategories:", err);
      }
    }
    fetchSubcategories();
    return () => { active = false; };
  }, [isAddBalanceOpen, selectedCatId, sessionToken]);

  const loanAmount = useMemo(() => getLoanAmount(property), [property]);

  // The statement comes from the server: GET /api/properties/{id}/pnl returns
  // one line per category with both financial years already summed, the
  // depreciation deduction from the stored schedules, and footed totals.
  //
  // It replaces a useMemo that summed this page's `transactions` array, which
  // is one 50-row page of DISPLAY-grain rows seeded with hardcoded FY2026 and
  // FY2027 figures. That version deducted the private slice of every
  // part-private bill (it summed containers, not the money grain), expensed
  // capital purchases in full in their purchase year, added expenses to income
  // because the API returns non-negative magnitudes, and reported one page as a
  // whole year.
  const pnl = usePnlSummary(propertyId, pnlFinancialYear, {
    enabled: showPnLStatement,
  });

  // Expenses and depreciation are printed as separate bands but deducted
  // together, so the cards and the chart read the combined figure — otherwise
  // income minus expenses would not equal the net profit shown beside them.
  const pnlTotals = useMemo(() => {
    const t = pnl.summary?.totals;
    const sum = (a: number | undefined, b: number | undefined) => (a ?? 0) + (b ?? 0);
    return {
      incomeCurrent: t?.income.current.gross ?? 0,
      incomePrevious: t?.income.previous.gross ?? 0,
      expenseCurrent: sum(t?.expenses.current.gross, t?.deductions.current.gross),
      expensePrevious: sum(t?.expenses.previous.gross, t?.deductions.previous.gross),
      // Signed: negative is a loss. The server subtracts; nothing here re-derives it.
      netCurrent: t?.netProfit.current.gross ?? 0,
      netPrevious: t?.netProfit.previous.gross ?? 0,
    };
  }, [pnl.summary]);

  // Top five deductions by value, for the breakdown bars. Depreciation is
  // included because on most rental properties it is one of the largest.
  const pnlTopExpenses = useMemo(() => {
    const rows = [
      ...(pnl.summary?.expenses ?? []).map((line) => ({
        label: pnlLineLabel(line),
        amount: line.current.gross,
      })),
      ...(pnl.summary?.deductions ?? []).map((line) => ({
        label: line.label,
        amount: line.current.gross,
      })),
    ];
    return rows.sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [pnl.summary]);

  // Written from the server response, so the file and the screen cannot
  // disagree. The previous version re-derived every figure from the raw
  // transaction array, which meant the export reproduced the statement's bugs
  // independently rather than inheriting them.
  const handleExportPnLCsv = () => {
    const summary = pnl.summary;
    if (!property || !summary) return;

    const esc = (value: string | number | null | undefined) => {
      const s = value == null ? "" : String(value);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const money = (value: number) => value.toFixed(2);
    const changeCell = (current: number, previous: number) => {
      const pct = pnlChangePct(current, previous);
      return pct === null ? "-" : `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
    };

    const lines: string[] = [];
    lines.push(`--- PROFIT & LOSS STATEMENT - ${property.name} ---`);
    lines.push(`Reporting Period: ${summary.period.from} to ${summary.period.to} (${summary.period.label})`);
    // Stated explicitly: the backend only has invoice_date, so these figures
    // are accruals basis and must not be transcribed onto a cash-basis return.
    lines.push(`Basis: accruals (dated by ${summary.dateBasis})`);
    lines.push("");

    const header = ["Category"];
    if (compareWithPrevious) header.push(`${summary.comparison.label} Gross`);
    header.push("Gross", "GST", "Net");
    if (compareWithPrevious) header.push("Change %");
    lines.push(header.map(esc).join(","));

    const bandRow = (
      label: string,
      current: { gross: number; gst: number; net: number },
      previous: { gross: number; gst: number; net: number },
    ) => {
      const cells: (string | number)[] = [label];
      if (compareWithPrevious) cells.push(money(previous.gross));
      cells.push(money(current.gross), money(current.gst), money(current.net));
      if (compareWithPrevious) cells.push(changeCell(current.gross, previous.gross));
      return cells.map(esc).join(",");
    };

    lines.push("01 INCOME");
    for (const line of summary.income) {
      lines.push(bandRow(pnlLineLabel(line), line.current, line.previous));
    }
    lines.push(bandRow("Total Income", summary.totals.income.current, summary.totals.income.previous));

    lines.push("");
    lines.push("02 EXPENSE");
    for (const line of summary.expenses) {
      lines.push(bandRow(pnlLineLabel(line), line.current, line.previous));
    }
    lines.push(bandRow("Total Expense", summary.totals.expenses.current, summary.totals.expenses.previous));

    if (summary.deductions.length > 0) {
      lines.push("");
      lines.push("03 DEPRECIATION");
      for (const line of summary.deductions) {
        lines.push(bandRow(line.label, line.current, line.previous));
      }
      lines.push(bandRow(
        "Total Depreciation",
        summary.totals.deductions.current,
        summary.totals.deductions.previous,
      ));
    }

    lines.push("");
    lines.push(bandRow(
      "Net Profit / (Loss)",
      summary.totals.netProfit.current,
      summary.totals.netProfit.previous,
    ));

    const safeName = (property.name || propertyId).replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "Property";
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Profit_Loss_${safeName}_${summary.period.financialYear}_Export.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGrossChange = (val: string) => {
    setBalanceGross(val);
    const num = parseFloat(val);
    if (!Number.isNaN(num)) {
      setBalanceGst((num / 11).toFixed(2));
    } else {
      setBalanceGst("");
    }
  };

  const costBaseAutoRows = useMemo(() => {
    // Baseline mock values
    const rows = [
      { category: "Property Purchase", source: "Property Transaction", gross: 500000.00, gst: 0.00, net: 500000.00 },
      { category: "Legal Fees", source: "Reconciliation", gross: 5500.00, gst: 500.00, net: 5000.00 },
      { category: "Stamp Duty", source: "Property Transaction", gross: 10000.00, gst: 0.00, net: 10000.00 }
    ];

    // Merge actual transactions if any match
    for (const t of transactions) {
      if (t.transactionType === "personal" || t.reviewStatus === "rejected") continue;

      const grossVal = t.splitGrossAmount !== undefined && t.splitGrossAmount !== null ? t.splitGrossAmount : t.transactionGrossAmount;
      const gstVal = t.splitGstAmount !== undefined && t.splitGstAmount !== null ? t.splitGstAmount : t.transactionGstAmount;
      const netVal = t.splitNetAmount !== undefined && t.splitNetAmount !== null ? t.splitNetAmount : t.transactionNetAmount;
      const name = (t.subcategoryName || t.categoryName || "").toLowerCase();

      if (name.includes("property purchase") || name.includes("purchase")) {
        const row = rows.find(r => r.category === "Property Purchase");
        if (row) {
          row.gross = Math.abs(grossVal);
          row.gst = Math.abs(gstVal);
          row.net = Math.abs(netVal);
        }
      } else if (name.includes("stamp duty") || name.includes("stamp")) {
        const row = rows.find(r => r.category === "Stamp Duty");
        if (row) {
          row.gross = Math.abs(grossVal);
          row.gst = Math.abs(gstVal);
          row.net = Math.abs(netVal);
        }
      } else if (name.includes("legal") || name.includes("conveyancing")) {
        const row = rows.find(r => r.category === "Legal Fees");
        if (row) {
          row.gross = Math.abs(grossVal);
          row.gst = Math.abs(gstVal);
          row.net = Math.abs(netVal);
        }
      }
    }

    return rows;
  }, [transactions]);

  const handleExportCostBaseCsv = () => {
    if (!property) return;
    const esc = (value: string | number | null | undefined) => {
      const s = value == null ? "" : String(value);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const money = (value: number) => value.toFixed(2);

    const lines: string[] = [];
    lines.push(`--- PROPERTY COST BASE - ${property.name} ---`);
    lines.push(`Contract Date: ${formatDisplayDate(contractDate)}`);
    lines.push(`Settlement Date: ${formatDisplayDate(settlementDate)}`);
    lines.push("");

    lines.push("--- AUTO-FILLED COST BASE TRANSACTIONS ---");
    lines.push(["Category", "Source", "Gross", "GST", "Net"].map(esc).join(","));
    for (const r of costBaseAutoRows) {
      lines.push([r.category, `Source: ${r.source}`, money(r.gross), money(r.gst), money(r.net)].map(esc).join(","));
    }
    const autoGrossTotal = costBaseAutoRows.reduce((sum, r) => sum + r.gross, 0);
    const autoGstTotal = costBaseAutoRows.reduce((sum, r) => sum + r.gst, 0);
    const autoNetTotal = costBaseAutoRows.reduce((sum, r) => sum + r.net, 0);
    lines.push(["Total Auto-filled", "", money(autoGrossTotal), money(autoGstTotal), money(autoNetTotal)].map(esc).join(","));
    lines.push("");

    lines.push("--- MANUAL COST BASE BALANCE ---");
    lines.push(["Category", "Gross Amount", "Estimated Net"].map(esc).join(","));
    for (const r of manualCostBaseRows) {
      lines.push([r.category, money(parseFloat(r.gross) || 0), money(parseFloat(r.net) || 0)].map(esc).join(","));
    }
    const manualGrossTotal = manualCostBaseRows.reduce((sum, r) => sum + (parseFloat(r.gross) || 0), 0);
    const manualNetTotal = manualCostBaseRows.reduce((sum, r) => sum + (parseFloat(r.net) || 0), 0);
    lines.push(["Total Manual", money(manualGrossTotal), money(manualNetTotal)].map(esc).join(","));
    lines.push("");

    lines.push(`Grand Total,,${money(autoNetTotal + manualGrossTotal)}`);

    const safeName = (property.name || propertyId).replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "Property";
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Cost_Base_${safeName}_Export.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "-";
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const handleAddManualCostBaseRow = () => {
    setManualCostBaseRows(prev => [
      ...prev,
      { id: String(Date.now()), category: "", gross: "", net: "" }
    ]);
  };

  const handleDeleteManualCostBaseRow = (id: string) => {
    setManualCostBaseRows(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateManualCostBaseRow = (id: string, field: "category" | "gross" | "net", value: string) => {
    setManualCostBaseRows(prev => prev.map(r => {
      if (r.id === id) {
        return { ...r, [field]: value };
      }
      return r;
    }));
  };

  const handleAddBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;
    if (!selectedCatId || !selectedSubcatId || !balanceDate || !balanceGross) {
      setBalanceError("Please fill out all required fields.");
      return;
    }

    setIsSubmittingBalance(true);
    setBalanceError("");

    try {
      const grossNum = parseFloat(balanceGross);
      const gstNum = parseFloat(balanceGst) || 0;

      const body = {
        type: addBalanceType,
        category_id: Number(selectedCatId),
        subcategory_id: Number(selectedSubcatId),
        invoice_date: balanceDate,
        gross_amount: addBalanceType === "expense" ? -Math.abs(grossNum) : Math.abs(grossNum),
        gst_amount: addBalanceType === "expense" ? -Math.abs(gstNum) : Math.abs(gstNum),
        description: balanceDesc.trim() || null,
        is_asset_purchase: false,
        splits: [{ property_id: propertyId, split_percentage: 100 }]
      };

      const res = await fetch(`/api/entities/${encodeURIComponent(property.entityId)}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || "Failed to save balance.");
      }

      setIsAddBalanceOpen(false);
      setBalanceGross("");
      setBalanceGst("");
      setBalanceDesc("");
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      setBalanceError(err.message || "Failed to save balance.");
    } finally {
      setIsSubmittingBalance(false);
    }
  };

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

  // Both panels read the server rather than this page's `transactions` array.
  //
  // That array is one capped page of split-level rows at display grain, so
  // filtering it for personal spending missed every partial private-use split
  // (the personal child is hidden there and its container is typed 'expense')
  // and truncated the rest. Neither hook invents a fallback: empty is empty.
  //
  // The property scope sums per-property SLICES, so a bill split across two
  // properties contributes only its own share here.
  const personal = usePersonalSummary("property", propertyId);
  const assets = useAssetTransactions("property", propertyId);

  const personalBreakdown = useMemo(() => {
    const categories = personal.summary?.categories ?? [];
    return {
      // Private spending is money out by definition, so the API returns
      // magnitudes and the sign is applied here — there is no revenue side.
      expenses: categories.map((c) => ({
        category: personalCategoryLabel(c),
        amount: -c.grossAmount,
      })),
      totalExpense: -(personal.summary?.totalGross ?? 0),
    };
  }, [personal.summary]);

  const assetTransactionsList = useMemo(
    () =>
      assets.rows.map((t) => ({
        id: t.id,
        description: assetItemName(t),
        category: t.categoryName || "—",
        property: t.propertyNames?.[0] || property?.name || "—",
        date: formatDate(t.invoiceDate),
        amount: -(t.grossAmount ?? 0),
      })),
    [assets.rows, property],
  );

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
        {showPnLStatement ? (
          <>
            {/* P&L Back Button */}
            <div style={{ marginBottom: "20px" }}>
              <button
                onClick={() => setShowPnLStatement(false)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "none",
                  border: "none",
                  color: "#475569",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "16px", height: "16px", stroke: "currentColor", strokeWidth: 2.5, fill: "none" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Back to Property
              </button>
            </div>

            {/* P&L Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
              <div>
                <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800, color: "#1c244b" }}>Profit & Loss Statement</h1>
                <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#64748b", fontWeight: 500 }}>
                  {/* No invented entity name. This header sits above a tax
                      statement; "Smith & Co." appearing on a property whose
                      entity has not loaded is worse than the entity being
                      absent. */}
                  {[property.name, entity?.name, titleCase(property.propertyType)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {/* FY Dropdown */}
                <select
                  value={pnlFinancialYear}
                  onChange={(e) => setPnlFinancialYear(Number(e.target.value))}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#1e293b",
                    fontSize: "14px",
                    fontWeight: 600,
                    height: "40px",
                    cursor: "pointer",
                    outline: "none"
                  }}
                >
                  {Array.from({ length: 6 }, (_, i) => auFinancialYearOf(new Date()) - i).map((year) => (
                    <option key={year} value={year}>
                      FY {year - 1}-{String(year).slice(-2)}
                    </option>
                  ))}
                </select>

                {/* Compare Toggle */}
                <button
                  type="button"
                  onClick={() => setCompareWithPrevious(!compareWithPrevious)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    backgroundColor: "#ffffff",
                    padding: "0 24px 0 16px",
                    border: "1.5px solid #cbd5e1",
                    borderRadius: "9999px",
                    height: "44px",
                    cursor: "pointer",
                    outline: "none",
                    transition: "all 0.2s ease",
                    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#94a3b8";
                    e.currentTarget.style.backgroundColor = "#f8fafc";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#cbd5e1";
                    e.currentTarget.style.backgroundColor = "#ffffff";
                  }}
                >
                  {/* Switch Pill */}
                  <span
                    style={{
                      width: "46px",
                      height: "24px",
                      borderRadius: "999px",
                      backgroundColor: compareWithPrevious ? "#12b76a" : "#cbd5e1",
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "2px",
                      transition: "background-color 0.2s ease"
                    }}
                  >
                    {/* Knob */}
                    <span
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        backgroundColor: "#ffffff",
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
                        transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        transform: compareWithPrevious ? "translateX(22px)" : "translateX(0)"
                      }}
                    />
                  </span>

                  {/* Text */}
                  <span
                    style={{
                      fontSize: "15px",
                      fontWeight: 700,
                      color: "#1c244b",
                      whiteSpace: "nowrap"
                    }}
                  >
                    Compare with previous year
                  </span>
                </button>

                {/* Export Button. Disabled until the statement has loaded —
                    the CSV is written from the same response the screen
                    renders, so there is nothing to export before then. */}
                <button
                  onClick={handleExportPnLCsv}
                  disabled={!pnl.summary}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "0 16px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: pnl.summary ? "#334155" : "#94a3b8",
                    fontSize: "14px",
                    fontWeight: 700,
                    height: "40px",
                    cursor: pnl.summary ? "pointer" : "not-allowed",
                    transition: "all 0.2s"
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "16px", height: "16px" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Export P&L
                </button>

                {/* Add Balance Button */}
                <button
                  onClick={() => setIsAddBalanceOpen(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "0 16px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "#28336e",
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: 700,
                    height: "40px",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1f2753';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#28336e';
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ width: "12px", height: "12px" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add Balance
                </button>
              </div>
            </div>

            {/* P&L load failure. The statement is cleared rather than left
                stale — a confident wrong total on a tax screen is worse than
                none — so this replaces the numbers instead of sitting above
                them. */}
            {pnl.error && (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                padding: "16px 20px",
                marginBottom: "24px",
                borderRadius: "12px",
                border: "1.5px solid #fecaca",
                backgroundColor: "#fef2f2"
              }}>
                <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#b91c1c" }}>
                  {pnl.error}
                </span>
                <button
                  type="button"
                  onClick={pnl.reload}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid #fecaca",
                    backgroundColor: "#ffffff",
                    color: "#b91c1c",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    flexShrink: 0
                  }}
                >
                  Try again
                </button>
              </div>
            )}

            {(() => {
              if (pnl.isLoading && !pnl.summary) {
                const placeholder = (height: string) => ({
                  height,
                  borderRadius: "16px",
                  backgroundColor: "#e2e8f0",
                  opacity: 0.6
                });
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
                      {[0, 1, 2].map((i) => (
                        <div key={`pnl-card-skeleton-${i}`} style={placeholder("108px")} />
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: "24px", alignItems: "start" }}>
                      <div style={placeholder("420px")} />
                      <div style={placeholder("420px")} />
                    </div>
                  </div>
                );
              }

              const summary = pnl.summary;
              if (!summary) return null;

              const formatPLAmount = (num: number) =>
                num.toLocaleString("en-AU", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                });

              const {
                incomeCurrent,
                incomePrevious,
                expenseCurrent,
                expensePrevious,
                netCurrent,
                netPrevious
              } = pnlTotals;

              const incomeChangePct = pnlChangePct(incomeCurrent, incomePrevious);
              const expenseChangePct = pnlChangePct(expenseCurrent, expensePrevious);
              const netChangeDiff = netCurrent - netPrevious;

              // A change line is only drawn when there is a prior year to
              // compare against. The old version rendered a hardcoded "▲ 0.0%"
              // and a hardcoded "▼ Loss widened" regardless of direction, so a
              // brand-new property reported confident movement against nothing.
              const changeLine = (pct: number | null, higherIsGood: boolean) => {
                if (pct === null) {
                  return (
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#94a3b8", marginTop: "8px" }}>
                      No {summary.comparison.label} figure
                    </div>
                  );
                }
                const good = pct >= 0 ? higherIsGood : !higherIsGood;
                return (
                  <div style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: good ? "#10b981" : "#ef4444",
                    marginTop: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}>
                    {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}% vs {summary.comparison.label}
                  </div>
                );
              };

              const isEmpty =
                summary.income.length === 0 &&
                summary.expenses.length === 0 &&
                summary.deductions.length === 0;

              const columnCount = compareWithPrevious ? 6 : 4;

              const amountCells = (
                current: { gross: number; gst: number; net: number },
                previous: { gross: number; gst: number; net: number },
                bold: boolean,
                color: string,
                higherIsGood: boolean
              ) => {
                const pct = pnlChangePct(current.gross, previous.gross);
                const cellBase = {
                  textAlign: "right" as const,
                  padding: bold ? "14px 8px" : "12px 8px",
                  fontSize: "13.5px",
                  fontWeight: bold ? 700 : 600,
                  color: bold ? color : "#475569"
                };
                return (
                  <>
                    {compareWithPrevious && (
                      <td style={cellBase}>{formatPLAmount(previous.gross)}</td>
                    )}
                    <td style={cellBase}>{formatPLAmount(current.gross)}</td>
                    <td style={{ ...cellBase, fontWeight: bold ? 700 : 500, color: bold ? color : "#64748b" }}>
                      {formatPLAmount(current.gst)}
                    </td>
                    <td style={{ ...cellBase, color: bold ? color : "#1e293b" }}>
                      {formatPLAmount(current.net)}
                    </td>
                    {compareWithPrevious && (
                      <td style={{
                        textAlign: "right",
                        padding: bold ? "14px 8px" : "12px 8px",
                        fontSize: "13px",
                        fontWeight: 700,
                        color: pct === null
                          ? "#94a3b8"
                          : (pct >= 0) === higherIsGood ? "#10b981" : "#ef4444"
                      }}>
                        {pct === null ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`}
                      </td>
                    )}
                  </>
                );
              };

              const bandHeader = (key: string, label: string) => (
                <tr key={key} style={{ backgroundColor: "#f8fafc" }}>
                  <td colSpan={columnCount} style={{ padding: "8px 8px", fontSize: "12px", fontWeight: 800, color: "#1c244b" }}>
                    {label}
                  </td>
                </tr>
              );

              const detailRow = (
                key: string,
                label: string,
                current: { gross: number; gst: number; net: number },
                previous: { gross: number; gst: number; net: number },
                higherIsGood: boolean
              ) => (
                <tr key={key} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px 8px 12px 16px", fontSize: "13.5px", fontWeight: 500, color: "#334155" }}>
                    {label}
                  </td>
                  {amountCells(current, previous, false, "#334155", higherIsGood)}
                </tr>
              );

              const totalRow = (
                key: string,
                label: string,
                current: { gross: number; gst: number; net: number },
                previous: { gross: number; gst: number; net: number },
                color: string,
                higherIsGood: boolean
              ) => (
                <tr key={key} style={{ borderBottom: "1.5px solid #e2e8f0" }}>
                  <td style={{ padding: "14px 8px", fontSize: "13.5px", fontWeight: 700, color }}>{label}</td>
                  {amountCells(current, previous, true, color, higherIsGood)}
                </tr>
              );

              const spacerRow = (key: string) => (
                <tr key={key} style={{ backgroundColor: "#f8fafc", height: "10px" }}>
                  <td colSpan={columnCount} style={{ padding: 0 }}></td>
                </tr>
              );

              const maxExpenseVal = pnlTopExpenses.length > 0
                ? Math.max(pnlTopExpenses[0].amount, 1)
                : 1;
              const maxChartVal = Math.max(incomeCurrent, expenseCurrent, 1);

              return (
                <>
                  {/* P&L Metric Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", marginBottom: "24px" }}>
                    {/* TOTAL INCOME */}
                    <div style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid #e2e8f0",
                      borderRadius: "16px",
                      padding: "20px 24px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center"
                    }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>TOTAL INCOME</div>
                      <div style={{ fontSize: "28px", fontWeight: 800, color: "#10b981", marginTop: "4px" }}>
                        A$ {formatPLAmount(incomeCurrent)}
                      </div>
                      {changeLine(incomeChangePct, true)}
                    </div>

                    {/* TOTAL EXPENSES — expenses plus depreciation, so that
                        income minus this equals the net profit beside it. The
                        table below keeps the two bands separate. */}
                    <div style={{
                      backgroundColor: "#ffffff",
                      border: "1.5px solid #e2e8f0",
                      borderRadius: "16px",
                      padding: "20px 24px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center"
                    }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        TOTAL EXPENSES{summary.deductions.length > 0 ? " (INCL. DEPRECIATION)" : ""}
                      </div>
                      <div style={{ fontSize: "28px", fontWeight: 800, color: "#ef4444", marginTop: "4px" }}>
                        A$ {formatPLAmount(expenseCurrent)}
                      </div>
                      {changeLine(expenseChangePct, false)}
                    </div>

                    {/* NET PROFIT / (LOSS) — the one genuinely signed figure. */}
                    <div style={{
                      backgroundColor: "#28336e",
                      borderRadius: "16px",
                      padding: "20px 24px",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center"
                    }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>NET PROFIT / (LOSS)</div>
                      <div style={{ fontSize: "28px", fontWeight: 800, color: "#ffffff", marginTop: "4px" }}>
                        {netCurrent < 0 ? "-" : ""}A$ {formatPLAmount(Math.abs(netCurrent))}
                      </div>
                      <div style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: netChangeDiff >= 0 ? "#4ade80" : "#fca5a5",
                        marginTop: "8px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                      }}>
                        {netChangeDiff >= 0 ? "▲" : "▼"} A$ {formatPLAmount(Math.abs(netChangeDiff))} vs {summary.comparison.label}
                      </div>
                    </div>
                  </div>

                  {/* P&L Layout Content */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: "24px", alignItems: "start" }}>
                    {/* Table Column */}
                    <div style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "16px",
                      border: "1.5px solid #e2e8f0",
                      padding: "24px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1c244b" }}>Statement of Profit &amp; Loss</h3>
                        <span style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          backgroundColor: "#f1f5f9",
                          color: "#475569",
                          padding: "4px 10px",
                          borderRadius: "9999px"
                        }}>
                          Reporting period: {formatDisplayDate(summary.period.from)} &ndash; {formatDisplayDate(summary.period.to)}
                        </span>
                      </div>

                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ borderBottom: "1.5px solid #e2e8f0" }}>
                            <th style={{ textAlign: "left", padding: "10px 8px", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Category</th>
                            {compareWithPrevious && (
                              <th style={{ textAlign: "right", padding: "10px 8px", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>{summary.comparison.label}</th>
                            )}
                            <th style={{ textAlign: "right", padding: "10px 8px", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Gross</th>
                            <th style={{ textAlign: "right", padding: "10px 8px", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>GST</th>
                            <th style={{ textAlign: "right", padding: "10px 8px", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Net</th>
                            {compareWithPrevious && (
                              <th style={{ textAlign: "right", padding: "10px 8px", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Change</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {isEmpty ? (
                            <tr>
                              <td colSpan={columnCount} style={{ padding: "48px 8px", textAlign: "center", fontSize: "13.5px", fontWeight: 600, color: "#64748b" }}>
                                No income or expenses recorded for {summary.period.label}.
                              </td>
                            </tr>
                          ) : (
                            <>
                              {bandHeader("band-income", "01 INCOME")}
                              {summary.income.map((line) =>
                                detailRow(
                                  `income-${line.categoryId}-${line.subcategoryId}`,
                                  pnlLineLabel(line),
                                  line.current,
                                  line.previous,
                                  true
                                )
                              )}
                              {totalRow(
                                "total-income",
                                "Total Income",
                                summary.totals.income.current,
                                summary.totals.income.previous,
                                "#10b981",
                                true
                              )}

                              {spacerRow("spacer-expense")}
                              {bandHeader("band-expense", "02 EXPENSE")}
                              {summary.expenses.map((line) =>
                                detailRow(
                                  `expense-${line.categoryId}-${line.subcategoryId}`,
                                  pnlLineLabel(line),
                                  line.current,
                                  line.previous,
                                  false
                                )
                              )}
                              {totalRow(
                                "total-expense",
                                "Total Expense",
                                summary.totals.expenses.current,
                                summary.totals.expenses.previous,
                                "#ef4444",
                                false
                              )}

                              {/* Depreciation is its own band: these lines have
                                  no transactions in the reporting year, only a
                                  schedule written when the asset was saved. */}
                              {summary.deductions.length > 0 && (
                                <>
                                  {spacerRow("spacer-depreciation")}
                                  {bandHeader("band-depreciation", "03 DEPRECIATION")}
                                  {summary.deductions.map((line) =>
                                    detailRow(
                                      `deduction-${line.kind}`,
                                      line.label,
                                      line.current,
                                      line.previous,
                                      false
                                    )
                                  )}
                                  {totalRow(
                                    "total-depreciation",
                                    "Total Depreciation",
                                    summary.totals.deductions.current,
                                    summary.totals.deductions.previous,
                                    "#ef4444",
                                    false
                                  )}
                                </>
                              )}

                              {/* Net Profit / (Loss) */}
                              <tr style={{ backgroundColor: "#28336e", color: "#ffffff" }}>
                                <td style={{ padding: "16px 12px", fontSize: "14px", fontWeight: 800, borderBottomLeftRadius: "8px", borderTopLeftRadius: "8px" }}>Net Profit / (Loss)</td>
                                {compareWithPrevious && (
                                  <td style={{ textAlign: "right", padding: "16px 12px", fontSize: "14px", fontWeight: 800 }}>
                                    {formatPLAmount(summary.totals.netProfit.previous.gross)}
                                  </td>
                                )}
                                <td style={{ textAlign: "right", padding: "16px 12px", fontSize: "14px", fontWeight: 800 }}>
                                  {formatPLAmount(summary.totals.netProfit.current.gross)}
                                </td>
                                <td style={{ textAlign: "right", padding: "16px 12px", fontSize: "14px", fontWeight: 800 }}>
                                  {formatPLAmount(summary.totals.netProfit.current.gst)}
                                </td>
                                <td style={{ textAlign: "right", padding: "16px 12px", fontSize: "14px", fontWeight: 800, borderBottomRightRadius: compareWithPrevious ? "0" : "8px", borderTopRightRadius: compareWithPrevious ? "0" : "8px" }}>
                                  {formatPLAmount(summary.totals.netProfit.current.net)}
                                </td>
                                {compareWithPrevious && (
                                  <td style={{ textAlign: "right", padding: "16px 12px", borderBottomRightRadius: "8px", borderTopRightRadius: "8px" }}>
                                    <span style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "2px",
                                      backgroundColor: netChangeDiff < 0 ? "#ef4444" : "#10b981",
                                      color: "#ffffff",
                                      padding: "2px 8px",
                                      borderRadius: "4px",
                                      fontSize: "11px",
                                      fontWeight: 800
                                    }}>
                                      {netChangeDiff < 0 ? "▼" : "▲"} A$ {formatPLAmount(Math.abs(netChangeDiff))}
                                    </span>
                                  </td>
                                )}
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>

                      {/* The backend has only invoice_date, so this statement
                          is accruals basis. Said out loud so nobody transcribes
                          it onto a cash-basis return. */}
                      <p style={{ margin: "16px 0 0 0", fontSize: "11.5px", color: "#94a3b8", fontWeight: 600 }}>
                        Accruals basis &mdash; dated by invoice date. Asset purchases are excluded from expenses and
                        claimed through the depreciation schedule.
                      </p>
                    </div>

                    {/* Right Side Column (Breakdown & Chart) */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                      {/* Expense Breakdown */}
                      <div style={{
                        backgroundColor: "#ffffff",
                        borderRadius: "16px",
                        border: "1.5px solid #e2e8f0",
                        padding: "24px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)"
                      }}>
                        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#1c244b" }}>Expense Breakdown</h3>
                        <p style={{ margin: "4px 0 16px 0", fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
                          Top categories for {summary.period.label}
                        </p>

                        {pnlTopExpenses.length === 0 ? (
                          <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8", fontWeight: 600 }}>
                            No expenses recorded.
                          </p>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            {pnlTopExpenses.map((exp, idx) => (
                              <div key={`exp-breakdown-${idx}`} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", fontWeight: 700, color: "#334155" }}>
                                  <span style={{ maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{exp.label}</span>
                                  <span style={{ color: "#1e293b", fontFamily: "monospace" }}>A$ {formatPLAmount(exp.amount)}</span>
                                </div>
                                <div style={{ width: "100%", height: "8px", backgroundColor: "#f1f5f9", borderRadius: "9999px", overflow: "hidden" }}>
                                  <div style={{ width: `${(exp.amount / maxExpenseVal) * 100}%`, height: "100%", backgroundColor: "#28336e", borderRadius: "9999px" }}></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Income vs Expense Bar Chart */}
                      <div style={{
                        backgroundColor: "#ffffff",
                        borderRadius: "16px",
                        border: "1.5px solid #e2e8f0",
                        padding: "24px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)"
                      }}>
                        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#1c244b" }}>Income vs Expense</h3>
                        <p style={{ margin: "4px 0 20px 0", fontSize: "12px", color: "#64748b", fontWeight: 600 }}>{summary.period.label}</p>

                        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end", height: "160px", paddingBottom: "10px", borderBottom: "1px solid #f1f5f9" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 800, color: "#10b981" }}>A$ {Math.round(incomeCurrent).toLocaleString()}</span>
                            <div style={{
                              width: "36px",
                              height: `${(incomeCurrent / maxChartVal) * 120}px`,
                              backgroundColor: "#10b981",
                              borderTopLeftRadius: "6px",
                              borderTopRightRadius: "6px",
                              transition: "height 0.3s ease"
                            }}></div>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", marginTop: "4px" }}>Income</span>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 800, color: "#ef4444" }}>A$ {Math.round(expenseCurrent).toLocaleString()}</span>
                            <div style={{
                              width: "36px",
                              height: `${(expenseCurrent / maxChartVal) * 120}px`,
                              backgroundColor: "#ef4444",
                              borderTopLeftRadius: "6px",
                              borderTopRightRadius: "6px",
                              transition: "height 0.3s ease"
                            }}></div>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", marginTop: "4px" }}>Expense</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Divider */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "40px 0 24px 0",
              position: "relative"
            }}>
              <div style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: "1px",
                backgroundColor: "#e2e8f0",
                zIndex: 1
              }}></div>
              <span style={{
                position: "relative",
                zIndex: 2,
                backgroundColor: "#f8fafc",
                padding: "0 16px",
                fontSize: "11px",
                fontWeight: 700,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.1em"
              }}>
                Property Cost Base Extension
              </span>
            </div>

            {/* Property Cost Base Section */}
            <div style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              border: "1.5px solid #e2e8f0",
              padding: "24px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
              marginBottom: "40px"
            }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#1c244b" }}>Property Cost Base</h2>
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b", fontWeight: 500 }}>
                    Built from this property's Income & Expense above, plus purchase & balance transactions &mdash; {property.name}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={handleExportCostBaseCsv}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      backgroundColor: "#ffffff",
                      color: "#334155",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                      height: "36px"
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "14px", height: "14px" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Export Property Cost Base
                  </button>
                  <button
                    onClick={() => setShowCostBase(!showCostBase)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      backgroundColor: "#ffffff",
                      color: "#334155",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                      height: "36px"
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "14px", height: "14px", transform: showCostBase ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.2s" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                    </svg>
                    {showCostBase ? "Hide Property Cost Base" : "Show Property Cost Base"}
                  </button>
                </div>
              </div>

              {showCostBase && (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  {/* Dates Row */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "24px",
                    padding: "16px 20px",
                    backgroundColor: "#f8fafc",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#475569" }}>Contract Date</span>
                      <input
                        type="date"
                        value={contractDate}
                        onChange={(e) => setContractDate(e.target.value)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          fontSize: "13px",
                          fontWeight: 600,
                          backgroundColor: "#ffffff"
                        }}
                      />
                      <span style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        backgroundColor: "#dbeafe",
                        color: "#2563eb",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        fontFamily: "monospace"
                      }}>
                        {formatDisplayDate(contractDate)}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#475569" }}>Settlement Date</span>
                      <input
                        type="date"
                        value={settlementDate}
                        onChange={(e) => setSettlementDate(e.target.value)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          fontSize: "13px",
                          fontWeight: 600,
                          backgroundColor: "#ffffff"
                        }}
                      />
                      <span style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        backgroundColor: "#dbeafe",
                        color: "#2563eb",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        fontFamily: "monospace"
                      }}>
                        {formatDisplayDate(settlementDate)}
                      </span>
                    </div>

                    {/* Notice */}
                    <div style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                      marginLeft: "auto",
                      maxWidth: "40%",
                      fontSize: "12px",
                      color: "#64748b",
                      lineHeight: 1.4
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "16px", height: "16px", color: "#3b82f6", flexShrink: 0, marginTop: "2px" }}>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4m0-4h.01" />
                      </svg>
                      <span>
                        Income & Expense used for this Property Cost Base are pulled directly from the Statement of Profit & Loss above &mdash; nothing is re-entered here.
                      </span>
                    </div>
                  </div>

                  {/* Auto-filled Section */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                      <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#1c244b" }}>Property Cost Base Transactions</h3>
                      <span style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        backgroundColor: "#f1f5f9",
                        color: "#475569",
                        padding: "2px 8px",
                        borderRadius: "4px"
                      }}>Auto-filled</span>
                    </div>

                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1.5px solid #e2e8f0" }}>
                          <th style={{ textAlign: "left", padding: "8px 8px", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Category</th>
                          <th style={{ textAlign: "left", padding: "8px 8px", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Source</th>
                          <th style={{ textAlign: "right", padding: "8px 8px", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Gross</th>
                          <th style={{ textAlign: "right", padding: "8px 8px", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>GST</th>
                          <th style={{ textAlign: "right", padding: "8px 8px", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {costBaseAutoRows.map((row, idx) => (
                          <tr key={`cost-base-auto-${idx}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "12px 8px", fontSize: "13px", fontWeight: 600, color: "#334155" }}>{row.category}</td>
                            <td style={{ padding: "12px 8px", fontSize: "12px" }}>
                              <span style={{
                                backgroundColor: row.source === "Reconciliation" ? "#dbeafe" : "#fef3c7",
                                color: row.source === "Reconciliation" ? "#2563eb" : "#d97706",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontWeight: 700
                              }}>
                                Source: {row.source}
                              </span>
                            </td>
                            <td style={{ textAlign: "right", padding: "12px 8px", fontSize: "13px", fontWeight: 600, color: "#475569" }}>
                              A$ {row.gross.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: "right", padding: "12px 8px", fontSize: "13px", color: "#64748b" }}>
                              A$ {row.gst.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: "right", padding: "12px 8px", fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
                              A$ {row.net.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                        {(() => {
                          const autoGrossTotal = costBaseAutoRows.reduce((sum, r) => sum + r.gross, 0);
                          const autoGstTotal = costBaseAutoRows.reduce((sum, r) => sum + r.gst, 0);
                          const autoNetTotal = costBaseAutoRows.reduce((sum, r) => sum + r.net, 0);

                          return (
                            <tr style={{ borderTop: "1.5px solid #cbd5e1" }}>
                              <td colSpan={2} style={{ padding: "14px 8px", fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>Auto-filled Property Cost Base Total</td>
                              <td style={{ textAlign: "right", padding: "14px 8px", fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
                                A$ {autoGrossTotal.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ textAlign: "right", padding: "14px 8px", fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
                                A$ {autoGstTotal.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ textAlign: "right", padding: "14px 8px", fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
                                A$ {autoNetTotal.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Manual Section */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#1c244b" }}>Balance</h3>
                        <span style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          backgroundColor: "#f1f5f9",
                          color: "#475569",
                          padding: "2px 8px",
                          borderRadius: "4px"
                        }}>Manual</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddManualCostBaseRow}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "6px 12px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          backgroundColor: "#ffffff",
                          color: "#1c244b",
                          fontSize: "12.5px",
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ width: "10px", height: "10px" }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add Category
                      </button>
                    </div>

                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1.5px solid #e2e8f0" }}>
                          <th style={{ textAlign: "left", padding: "8px 8px", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", width: "40%" }}>Category</th>
                          <th style={{ textAlign: "right", padding: "8px 8px", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", width: "25%" }}>Gross Amount</th>
                          <th style={{ textAlign: "right", padding: "8px 8px", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", width: "25%" }}>Estimated Net</th>
                          <th style={{ width: "10%" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {manualCostBaseRows.map((row) => (
                          <tr key={`cost-base-manual-${row.id}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "8px 8px" }}>
                              <input
                                type="text"
                                value={row.category}
                                placeholder="Category Name"
                                onChange={(e) => handleUpdateManualCostBaseRow(row.id, "category", e.target.value)}
                                style={{
                                  width: "90%",
                                  padding: "8px 12px",
                                  borderRadius: "8px",
                                  border: "1px solid #cbd5e1",
                                  fontSize: "13px",
                                  fontWeight: 500
                                }}
                              />
                            </td>
                            <td style={{ padding: "8px 8px", textAlign: "right" }}>
                              <input
                                type="number"
                                value={row.gross}
                                placeholder="Gross Amount"
                                onChange={(e) => handleUpdateManualCostBaseRow(row.id, "gross", e.target.value)}
                                style={{
                                  width: "80%",
                                  padding: "8px 12px",
                                  borderRadius: "8px",
                                  border: "1px solid #cbd5e1",
                                  fontSize: "13px",
                                  fontWeight: 500,
                                  textAlign: "right"
                                }}
                              />
                            </td>
                            <td style={{ padding: "8px 8px", textAlign: "right" }}>
                              <input
                                type="number"
                                value={row.net}
                                placeholder="Estimated Net"
                                onChange={(e) => handleUpdateManualCostBaseRow(row.id, "net", e.target.value)}
                                style={{
                                  width: "80%",
                                  padding: "8px 12px",
                                  borderRadius: "8px",
                                  border: "1px solid #cbd5e1",
                                  fontSize: "13px",
                                  fontWeight: 500,
                                  textAlign: "right"
                                }}
                              />
                            </td>
                            <td style={{ padding: "8px 8px", textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => handleDeleteManualCostBaseRow(row.id)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#ef4444",
                                  cursor: "pointer",
                                  padding: "4px"
                                }}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "16px", height: "16px" }}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(() => {
                          const manualGrossTotal = manualCostBaseRows.reduce((sum, r) => sum + (parseFloat(r.gross) || 0), 0);
                          const manualNetTotal = manualCostBaseRows.reduce((sum, r) => sum + (parseFloat(r.net) || 0), 0);

                          return (
                            <tr style={{ borderTop: "1.5px solid #cbd5e1" }}>
                              <td style={{ padding: "14px 8px", fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>Total Balance</td>
                              <td style={{ textAlign: "right", padding: "14px 8px", fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
                                A$ {manualGrossTotal.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td style={{ textAlign: "right", padding: "14px 8px", fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
                                A$ {manualNetTotal.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td></td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Card */}
                  {(() => {
                    const autoNetTotal = costBaseAutoRows.reduce((sum, r) => sum + r.net, 0);
                    const manualGrossTotal = manualCostBaseRows.reduce((sum, r) => sum + (parseFloat(r.gross) || 0), 0);
                    const grandTotalVal = autoNetTotal + manualGrossTotal;

                    return (
                      <div style={{
                        backgroundColor: "#28336e",
                        color: "#ffffff",
                        borderRadius: "12px",
                        padding: "24px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: 700, opacity: 0.9 }}>
                          <span>Auto-filled Property Cost Base (Net)</span>
                          <span style={{ fontFamily: "monospace" }}>
                            A$ {autoNetTotal.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: 700, opacity: 0.9 }}>
                          <span>+ Manual Balance (Gross)</span>
                          <span style={{ fontFamily: "monospace" }}>
                            A$ {manualGrossTotal.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div style={{ height: "1px", backgroundColor: "rgba(255, 255, 255, 0.15)", margin: "4px 0" }}></div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: 800 }}>
                          <span>Grand Total</span>
                          <span style={{ color: "#f4a117", fontSize: "20px" }}>
                            A$ {grandTotalVal.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Add Balance Modal */}
            {isAddBalanceOpen && (
              <div style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(15, 23, 42, 0.6)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999
              }} onClick={() => setIsAddBalanceOpen(false)}>
                <div style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "16px",
                  width: "100%",
                  maxWidth: "500px",
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                  overflow: "hidden"
                }} onClick={(e) => e.stopPropagation()}>

                  {/* Modal Header */}
                  <div style={{
                    backgroundColor: "#28336e",
                    padding: "20px 24px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    color: "#ffffff"
                  }}>
                    <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>Add Balance Record</h2>
                    <button
                      onClick={() => setIsAddBalanceOpen(false)}
                      style={{
                        background: "rgba(255, 255, 255, 0.15)",
                        border: "none",
                        borderRadius: "50%",
                        width: "30px",
                        height: "30px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        cursor: "pointer"
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "16px", height: "16px" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Modal Body */}
                  <form onSubmit={handleAddBalanceSubmit} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {balanceError && (
                      <div style={{ color: "#ef4444", fontSize: "13px", fontWeight: 700, backgroundColor: "#fef2f2", padding: "10px", borderRadius: "8px", border: "1px solid #fee2e2" }}>
                        {balanceError}
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      {/* Date */}
                      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>Invoice Date *</span>
                        <input
                          type="date"
                          required
                          value={balanceDate}
                          onChange={(e) => setBalanceDate(e.target.value)}
                          style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", fontWeight: 600 }}
                        />
                      </label>

                      {/* Type */}
                      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>Type *</span>
                        <select
                          value={addBalanceType}
                          onChange={(e) => setAddBalanceType(e.target.value as any)}
                          style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", fontWeight: 600, height: "38px" }}
                        >
                          <option value="revenue">Income</option>
                          <option value="expense">Expense</option>
                        </select>
                      </label>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      {/* Category */}
                      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>Category *</span>
                        <select
                          required
                          value={selectedCatId}
                          onChange={(e) => setSelectedCatId(e.target.value)}
                          style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", fontWeight: 600, height: "38px" }}
                        >
                          <option value="">Select Category</option>
                          {categoriesList.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </label>

                      {/* Subcategory */}
                      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>Subcategory *</span>
                        <select
                          required
                          disabled={!selectedCatId}
                          value={selectedSubcatId}
                          onChange={(e) => setSelectedSubcatId(e.target.value)}
                          style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", fontWeight: 600, height: "38px", opacity: selectedCatId ? 1 : 0.6 }}
                        >
                          <option value="">Select Subcategory</option>
                          {subcategoriesList.map((sub) => (
                            <option key={sub.id} value={sub.id}>{sub.name}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      {/* Gross Amount */}
                      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>Gross Amount (A$) *</span>
                        <input
                          type="number"
                          step="0.01"
                          required
                          placeholder="e.g. 100.00"
                          value={balanceGross}
                          onChange={(e) => handleGrossChange(e.target.value)}
                          style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", fontWeight: 600 }}
                        />
                      </label>

                      {/* GST Amount */}
                      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>GST Amount (A$)</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Calculated automatically"
                          value={balanceGst}
                          onChange={(e) => setBalanceGst(e.target.value)}
                          style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", fontWeight: 600 }}
                        />
                      </label>
                    </div>

                    {/* Description */}
                    <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>Description</span>
                      <input
                        type="text"
                        placeholder="e.g. Monthly rental statement"
                        value={balanceDesc}
                        onChange={(e) => setBalanceDesc(e.target.value)}
                        style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", fontWeight: 600 }}
                      />
                    </label>

                    {/* Submit Actions */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "10px" }}>
                      <button
                        type="button"
                        onClick={() => setIsAddBalanceOpen(false)}
                        style={{ padding: "10px 16px", borderRadius: "8px", border: "1.5px solid #cbd5e1", backgroundColor: "#ffffff", color: "#475569", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingBalance}
                        style={{ padding: "10px 16px", borderRadius: "8px", border: "none", backgroundColor: "#28336e", color: "#ffffff", fontSize: "14px", fontWeight: 700, cursor: isSubmittingBalance ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: "6px", opacity: isSubmittingBalance ? 0.7 : 1 }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#1f2753';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#28336e';
                        }}
                      >
                        {isSubmittingBalance ? "Saving..." : "Save Balance"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
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

                  {/* Borrowing Cost Button */}
                  <Link
                    href={borrowingCostHref}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      border: '1.5px solid #d0d5dd',
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      color: '#233069',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      height: '42px',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px", flexShrink: 0 }}>
                      <line x1="3" y1="22" x2="21" y2="22" />
                      <line x1="6" y1="18" x2="6" y2="11" />
                      <line x1="10" y1="18" x2="10" y2="11" />
                      <line x1="14" y1="18" x2="14" y2="11" />
                      <line x1="18" y1="18" x2="18" y2="11" />
                      <polygon points="12 2 20 7 4 7" />
                    </svg>
                    Borrowing Cost
                  </Link>

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
                    onClick={() => setShowPnLStatement(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '10px',
                      backgroundColor: '#28336e',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      height: '42px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#1f2753';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#28336e';
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
                          <path d="M3.54245 9.49163C4.09013 9.49163 4.53411 9.04765 4.53411 8.49997C4.53411 7.95228 4.09013 7.5083 3.54245 7.5083C2.99477 7.5083 2.55078 7.95228 2.55078 8.49997C2.55078 9.04765 2.99477 9.49163 3.54245 9.49163Z" fill="#1B2559" />
                          <path d="M8.49948 9.49163C9.04716 9.49163 9.49115 9.04765 9.49115 8.49997C9.49115 7.95228 9.04716 7.5083 8.49948 7.5083C7.9518 7.5083 7.50781 7.95228 7.50781 8.49997C7.50781 9.04765 7.9518 9.49163 8.49948 9.49163Z" fill="#1B2559" />
                          <path d="M13.4585 9.49163C14.0061 9.49163 14.4501 9.04765 14.4501 8.49997C14.4501 7.95228 14.0061 7.5083 13.4585 7.5083C12.9108 7.5083 12.4668 7.95228 12.4668 8.49997C12.4668 9.04765 12.9108 9.49163 13.4585 9.49163Z" fill="#1B2559" />
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
                    {/* Private spending by category. No revenue half: a
                        personal transaction is money out by definition, so the
                        section that used to sit here could only be empty.
                        Amounts are this property's slice of each bill. */}
                    <div>
                      <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: '#b91c1c', borderBottom: '1px solid #f2f4f7', paddingBottom: '8px' }}>
                        Private spending
                      </h4>
                      {personal.isLoading ? (
                        <p style={{ margin: 0, fontSize: '13px', color: '#667085' }}>Loading…</p>
                      ) : personal.error ? (
                        <p style={{ margin: 0, fontSize: '13px', color: '#b42318' }}>{personal.error}</p>
                      ) : personalBreakdown.expenses.length === 0 ? (
                        <p style={{ margin: 0, fontSize: '13px', color: '#667085' }}>
                          No personal transactions recorded for this property.
                        </p>
                      ) : (
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
                      )}
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
                    padding: '18px 24px',
                    border: '1px solid #dde4f2',
                    borderRadius: '16px',
                    background: '#ffffff',
                    boxShadow: '0 4px 12px rgba(16, 24, 40, 0.03)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s ease',
                    outline: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ background: '#fdf4e3', color: '#c27a00', borderRadius: '10px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                      </svg>
                    </span>
                    <div>
                      <strong style={{ display: 'block', fontSize: '16px', color: '#28336e', fontWeight: 700 }}>Asset Transactions</strong>
                      <span style={{ display: 'block', fontSize: '13px', color: '#828fa7', marginTop: '2px' }}>Expenses marked as asset purchases</span>
                    </div>
                  </div>
                  <span style={{ color: '#828fa7', display: 'flex', alignItems: 'center' }}>
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
                      borderRadius: '16px',
                      padding: '24px',
                      boxShadow: '0 4px 12px rgba(16, 24, 40, 0.03)',
                      overflowX: 'auto',
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '450px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #eef2f6' }}>
                          <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#828fa7', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Asset Name</th>
                          <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#828fa7', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date</th>
                          <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#828fa7', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Amount</th>
                          <th style={{ padding: '12px 8px', width: '24px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {assetTransactionsList.map((item, idx) => (
                          <tr
                            key={idx}
                            onClick={() => router.push(`/dashboard/accountant/clients/${clientId}/entities/${entityId}/properties/${propertyId}/assets/${item.id}`)}
                            style={{ borderBottom: idx === assetTransactionsList.length - 1 ? 'none' : '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.2s ease' }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <td style={{ padding: '16px 8px', fontSize: '14px', color: '#28336e', fontWeight: 700 }}>{item.description}</td>
                            <td style={{ padding: '16px 8px', fontSize: '13px', color: '#475569', whiteSpace: 'nowrap' }}>{item.date}</td>
                            <td style={{ padding: '16px 8px', fontSize: '14px', color: '#28336e', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>{formatAmount(item.amount)}</td>
                            <td style={{ padding: '16px 8px', textAlign: 'right', verticalAlign: 'middle' }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </td>
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
          </>
        )}
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
      {isGstSummaryOpen && (() => {
        const currentYear = auFinancialYearOf(new Date());
        const fyOptions = Array.from({ length: 6 }, (_, i) => currentYear - i).map(
          (year) => ({
            value: year,
            label: `FY${year} (Jul ${year - 1} – Jun ${year})`,
          }),
        );

        const periodOptions = [
          { value: 1, label: GST_QUARTER_LABELS[1] },
          { value: 2, label: GST_QUARTER_LABELS[2] },
          { value: 3, label: GST_QUARTER_LABELS[3] },
          { value: 4, label: GST_QUARTER_LABELS[4] },
          { value: GST_FULL_YEAR, label: "Full financial year" },
        ];

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }} onClick={() => setIsGstSummaryOpen(false)}>
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '540px',
              maxHeight: 'min(760px, 92vh)',
              boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(15, 23, 42, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }} onClick={(e) => e.stopPropagation()}>

              {/* Header */}
              <div style={{
                backgroundColor: 'var(--primary, #28336e)',
                padding: '18px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#ffffff',
                borderTopLeftRadius: '20px',
                borderTopRightRadius: '20px',
                flexShrink: 0,
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em' }}>GST Summary</h2>
                  <div style={{ fontSize: '12px', color: '#c7d2fe', marginTop: '2px', fontWeight: 500 }}>
                    {property.name}
                    {gstPeriodLabel ? ` · ${gstPeriodLabel}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGstSummaryOpen(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.color = '#cbd5e1';
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '16px', height: '16px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable Body */}
              <div style={{
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                overflowY: 'auto',
                flex: '1 1 auto',
              }}>

                {/* Period selectors — custom dropdowns */}
                <div style={{ display: 'flex', gap: '12px', zIndex: 100 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1', position: 'relative' }}>
                    <span style={{ fontSize: '12px', fontWeight: 650, color: '#475569' }}>
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
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        minHeight: '36px',
                        padding: '0 12px',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: '8px',
                        backgroundColor: '#ffffff',
                        color: '#1e293b',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s',
                        outline: 'none',
                        boxShadow: isFyDropdownOpen ? '0 0 0 3px rgba(40, 51, 110, 0.12)' : 'none',
                        borderColor: isFyDropdownOpen ? 'var(--primary, #28336e)' : '#cbd5e1',
                      }}
                      onMouseEnter={(e) => {
                        if (!isFyDropdownOpen) e.currentTarget.style.borderColor = '#94a3b8';
                      }}
                      onMouseLeave={(e) => {
                        if (!isFyDropdownOpen) e.currentTarget.style.borderColor = '#cbd5e1';
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {fyOptions.find(o => o.value === gstFinancialYear)?.label}
                      </span>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        style={{
                          width: '14px',
                          height: '14px',
                          color: '#64748b',
                          transition: 'transform 0.2s ease',
                          transform: isFyDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                      </svg>
                    </button>

                    {isFyDropdownOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 4px)',
                          left: 0,
                          right: 0,
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          boxShadow: '0 8px 16px -4px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
                          zIndex: 1000,
                          padding: '4px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1px',
                        }}
                      >
                        {fyOptions.map((option) => {
                          const isSelected = option.value === gstFinancialYear;
                          return (
                            <div
                              key={option.value}
                              onClick={() => {
                                setGstFinancialYear(option.value);
                                setIsFyDropdownOpen(false);
                              }}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: isSelected ? 600 : 500,
                                color: isSelected ? 'var(--primary, #28336e)' : '#334155',
                                backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = isSelected ? '#eff6ff' : '#f1f5f9';
                                if (!isSelected) e.currentTarget.style.color = '#0f172a';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = isSelected ? '#eff6ff' : 'transparent';
                                if (!isSelected) e.currentTarget.style.color = '#334155';
                              }}
                            >
                              <span>{option.label}</span>
                              {isSelected && (
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  style={{ width: '14px', height: '14px', color: 'var(--primary, #28336e)' }}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1', position: 'relative' }}>
                    <span style={{ fontSize: '12px', fontWeight: 650, color: '#475569' }}>
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
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        minHeight: '36px',
                        padding: '0 12px',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: '8px',
                        backgroundColor: '#ffffff',
                        color: '#1e293b',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s',
                        outline: 'none',
                        boxShadow: isPeriodDropdownOpen ? '0 0 0 3px rgba(40, 51, 110, 0.12)' : 'none',
                        borderColor: isPeriodDropdownOpen ? 'var(--primary, #28336e)' : '#cbd5e1',
                      }}
                      onMouseEnter={(e) => {
                        if (!isPeriodDropdownOpen) e.currentTarget.style.borderColor = '#94a3b8';
                      }}
                      onMouseLeave={(e) => {
                        if (!isPeriodDropdownOpen) e.currentTarget.style.borderColor = '#cbd5e1';
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {periodOptions.find(o => o.value === gstQuarter)?.label}
                      </span>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        style={{
                          width: '14px',
                          height: '14px',
                          color: '#64748b',
                          transition: 'transform 0.2s ease',
                          transform: isPeriodDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                      </svg>
                    </button>

                    {isPeriodDropdownOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 4px)',
                          left: 0,
                          right: 0,
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          boxShadow: '0 8px 16px -4px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
                          zIndex: 1000,
                          padding: '4px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1px',
                        }}
                      >
                        {periodOptions.map((option) => {
                          const isSelected = option.value === gstQuarter;
                          return (
                            <div
                              key={option.value}
                              onClick={() => {
                                setGstQuarter(option.value);
                                setIsPeriodDropdownOpen(false);
                              }}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: isSelected ? 600 : 500,
                                color: isSelected ? 'var(--primary, #28336e)' : '#334155',
                                backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = isSelected ? '#eff6ff' : '#f1f5f9';
                                if (!isSelected) e.currentTarget.style.color = '#0f172a';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = isSelected ? '#eff6ff' : 'transparent';
                                if (!isSelected) e.currentTarget.style.color = '#334155';
                              }}
                            >
                              <span>{option.label}</span>
                              {isSelected && (
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  style={{ width: '14px', height: '14px', color: 'var(--primary, #28336e)' }}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {isGstLoading && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#64748b',
                    padding: '4px 2px'
                  }}>
                    <svg viewBox="0 0 24 24" style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" stroke="#cbd5e1" strokeWidth="3" fill="none" style={{ opacity: 0.3 }} />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--primary, #28336e)" strokeWidth="3" strokeLinecap="round" fill="none" />
                    </svg>
                    <span>Updating figures…</span>
                  </div>
                )}

                {gstError && (
                  <div role="alert" style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#b42318',
                    backgroundColor: '#fef3f2',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #fda29b',
                  }}>
                    {gstError}
                  </div>
                )}

                {/* Table Column Headers */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '56px 1fr 120px',
                  paddingBottom: '8px',
                  borderBottom: '2px solid #f1f5f9',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.075em'
                }}>
                  <div>Code</div>
                  <div>Field</div>
                  <div style={{ textAlign: 'right' }}>Amount</div>
                </div>

                {/* Rows */}
                {/* Row G1 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '56px 1fr 120px',
                  alignItems: 'start',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #f1f5f9',
                }}>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: '#eff6ff',
                    color: 'var(--primary, #28336e)',
                    border: '1px solid #dbeafe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '12px',
                  }}>G1</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>Total Sales</span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Total Income/Sales including GST</span>
                    <div>
                      <span style={{
                        fontSize: '10px',
                        fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace',
                        color: '#64748b',
                        marginTop: '4px',
                        display: 'inline-block',
                        padding: '1px 6px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #f1f5f9',
                        borderRadius: '4px'
                      }}>
                        G1 = Total Income + GST on Sales = {formatGst(totalIncomeVal)} + {formatGst(gstSales)}
                      </span>
                    </div>
                  </div>
                  <div style={{
                    textAlign: 'right',
                    fontWeight: 700,
                    fontSize: '15px',
                    color: '#0f172a',
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums'
                  }}>
                    {formatGst(totalSalesVal)}
                  </div>
                </div>

                {/* Row 1A */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '56px 1fr 120px',
                  alignItems: 'start',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #f1f5f9',
                }}>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: '#fff7ed',
                    color: '#ea580c',
                    border: '1px solid #ffedd5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '12px',
                  }}>1A</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>GST on Sales</span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>GST collected on Income/Sales</span>
                  </div>
                  <div style={{
                    textAlign: 'right',
                    fontWeight: 700,
                    fontSize: '15px',
                    color: '#0f172a',
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums'
                  }}>
                    {formatGst(gstSales)}
                  </div>
                </div>

                {/* Row 1B */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '56px 1fr 120px',
                  alignItems: 'start',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #f1f5f9',
                }}>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: '#f0fdf4',
                    color: '#16a34a',
                    border: '1px solid #dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '12px',
                  }}>1B</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>GST on Purchases</span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>GST paid on Expenses/Purchases</span>
                  </div>
                  <div style={{
                    textAlign: 'right',
                    fontWeight: 700,
                    fontSize: '15px',
                    color: '#0f172a',
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums'
                  }}>
                    {formatGst(gstPurchases)}
                  </div>
                </div>

                {/* Row 9 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '56px 1fr 120px',
                  alignItems: 'start',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #f1f5f9',
                }}>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: '#faf5ff',
                    color: '#9333ea',
                    border: '1px solid #f3e8ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '12px',
                  }}>9</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>Refund / Payment Due</span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Net GST position (1A - 1B)</span>
                  </div>
                  <div style={{
                    textAlign: 'right',
                    fontWeight: 700,
                    fontSize: '15px',
                    color: '#0f172a',
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums'
                  }}>
                    {formatGst(Math.abs(refundOrPayment))}
                  </div>
                </div>

                {/* Net position Outcome Card */}
                <div style={{
                  background: refundOrPayment >= 0
                    ? 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)'
                    : 'linear-gradient(135deg, #fff1f2 0%, #fff5f5 100%)',
                  border: refundOrPayment >= 0
                    ? '1px solid #bbf7d0'
                    : '1px solid #fecdd3',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.01)',
                  marginTop: '4px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {refundOrPayment >= 0 ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '16px', height: '16px', color: '#16a34a' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '16px', height: '16px', color: '#dc2626' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                      </svg>
                    )}
                    <span style={{ fontWeight: 700, fontSize: '13px', color: refundOrPayment >= 0 ? '#14532d' : '#7f1d1d' }}>
                      {refundOrPayment >= 0 ? "Refund Due from ATO" : "Payment Due to ATO"}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: refundOrPayment >= 0 ? '#15803d' : '#b91c1c', fontWeight: 550 }}>
                    {refundOrPayment >= 0
                      ? `Formula: GST on Purchases - GST on Sales = ${formatGst(gstPurchases)} - ${formatGst(gstSales)}`
                      : `Formula: GST on Sales - GST on Purchases = ${formatGst(gstSales)} - ${formatGst(gstPurchases)}`
                    }
                  </span>
                  <span style={{
                    fontSize: '28px',
                    fontWeight: 800,
                    color: refundOrPayment >= 0 ? '#16a34a' : '#dc2626',
                    fontVariantNumeric: 'tabular-nums',
                    marginTop: '2px',
                    letterSpacing: '-0.02em'
                  }}>
                    {formatGst(Math.abs(refundOrPayment))}
                  </span>
                </div>

              </div>

              {/* Footer */}
              <div style={{
                padding: '14px 24px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
                borderBottomLeftRadius: '20px',
                borderBottomRightRadius: '20px',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: '11px', color: '#64748b', maxWidth: '62%', lineHeight: 1.4 }}>
                  Accruals basis, dated by invoice date &mdash; cash-basis reporting
                  will differ. Personal and rejected transactions are excluded.
                </span>
                <button
                  type="button"
                  onClick={handleExportGstCsv}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    border: '1.5px solid #1e293b',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    color: '#1e293b',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#0f172a';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                    e.currentTarget.style.borderColor = '#1e293b';
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "14px", height: "14px" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                  </svg>
                  Export CSV
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </>
  );
}
