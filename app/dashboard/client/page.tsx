"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useId, useRef } from "react";
import { Skeleton } from "boneyard-js/react";
import ThemeToggle from "@/app/components/ThemeToggle";
import { ClientPortfolioSkeleton } from "@/app/components/PortalSkeletons";
import { logout } from "@/src/lib/logout";
import { getIdToken } from "@/src/lib/authToken";
import {
  formatExactCurrency,
  formatClientPercent,
  signedTone,
  toneClass,
} from "@/app/components/clients/CurrencyFormatter";
import type { CoreEntity } from "@/src/lib/coreApi";
import { transactionTypeLabel } from "@/src/lib/transactionTypes";
import { isAwaitingExtraction, isAwaitingReview } from "@/src/lib/reviewStatus";
import {
  ReviewQueueCount,
  ReviewStatusBadge,
} from "@/app/components/ReviewStatusBadge";
import CashFlowChart from "@/app/components/clients/CashFlowChart";
import RegionError from "@/app/components/ui/RegionError";
import FinancialYearPicker from "@/app/components/ui/FinancialYearPicker";
import { usePortfolioSummary } from "@/app/components/usePortfolioSummary";
import { fetchCurrentUser, type CurrentUser } from "@/app/components/currentUser";
import {
  currentFinancialYear,
  fyLongLabel,
  fyRangeLabel,
  fyMonthKeys,
  fyShortLabel,
  monthAt,
  monthIndex,
  monthKey,
  monthShortLabel,
  percentChange,
  shiftMonth,
} from "@/app/components/clients/portfolioDashboard";
import {
  dropdownRegistryEvent,
  announceDropdownOpen,
  isDropdownRegistryEvent,
} from "@/src/lib/dropdownRegistry";

function titleCase(value: string) {
  if (!value) return "";
  return value
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatDate(dateString: string) {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (e) {
    return "";
  }
}

/**
 * Month-on-month change badge. Renders nothing when there is no honest number
 * (see percentChange) — these used to be hardcoded "+12%" / "-3.5%" strings
 * that showed even on an A$ 0 month. `goodWhenUp` is false for expenses, where
 * a rise is the bad direction.
 */
function TrendBadge({
  change,
  goodWhenUp = true,
  variant,
}: {
  change: number | null;
  goodWhenUp?: boolean;
  variant: "mobile" | "desktop";
}) {
  if (change === null) return null;
  const label = formatClientPercent(change, { showPlus: true });
  if (!/[1-9]/.test(label)) return null;
  const isUp = change > 0;
  const isGood = isUp === goodWhenUp;
  const title = "Compared with last month";
  if (variant === "mobile") {
    return (
      <span className={`m-db-trend-badge ${isGood ? "up" : "down"}`} title={title}>
        {label}
      </span>
    );
  }
  return (
    <span
      title={title}
      className={
        isGood
          ? "bg-[#ecfdf3] dark:bg-[var(--surface-2)] text-[#027a48] dark:text-[#5dcaa5] px-2 py-0.5 rounded-[20px] text-xs font-semibold"
          : "bg-[#fef3f2] dark:bg-[var(--surface-2)] text-[#b42318] dark:text-[#f09595] px-2 py-0.5 rounded-[20px] text-xs font-semibold"
      }
    >
      {label}
    </span>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '14px', height: '14px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

type SelectOption = {
  label: string;
  value: string;
};

type StaticSelectProps = {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  horizontal?: boolean;
};

function StaticSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  required,
  className = "",
  triggerClassName = "",
  disabled = false,
  horizontal = false,
}: StaticSelectProps) {
  const reactId = useId();
  const dropdownId = `transaction-select-${reactId}`;
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeIfAnotherOpened(event: Event) {
      if (
        isDropdownRegistryEvent(event) &&
        event.detail?.id &&
        event.detail.id !== dropdownId
      ) {
        setIsOpen(false);
      }
    }

    window.addEventListener(dropdownRegistryEvent, closeIfAnotherOpened);
    return () =>
      window.removeEventListener(dropdownRegistryEvent, closeIfAnotherOpened);
  }, [dropdownId]);

  useEffect(() => {
    if (isOpen) {
      announceDropdownOpen(dropdownId);
    }
  }, [dropdownId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div
      className={`transaction-field ${className}`}
      style={{
        minWidth: '200px',
        ...(horizontal && {
          flexDirection: 'row',
          alignItems: 'center',
          gap: '12px',
          minWidth: 'fit-content',
        }),
      }}
    >
      {label && (
        <span
          className="transaction-field-label"
          style={horizontal ? { margin: 0, whiteSpace: 'nowrap' } : undefined}
        >
          {label}
          {required && <em>*</em>}
        </span>
      )}
      <div
        ref={selectRef}
        className={`property-status-select transaction-select${isOpen ? " is-open" : ""
          }${disabled ? " is-disabled" : ""}`}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsOpen(false);
          }
        }}
      >
        <button
          type="button"
          className={triggerClassName || "property-status-trigger"}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              setIsOpen((current) => !current);
            }
          }}
        >
          <span>{selected?.label || placeholder || "Select"}</span>
          <ChevronIcon />
        </button>
        {isOpen && !disabled && (
          <div className="property-status-menu" role="listbox" style={{ zIndex: 50 }}>
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={value === option.value}
                className={value === option.value ? "is-selected" : ""}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span>{option.label}</span>
                {value === option.value && (
                  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '16px', height: '16px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                    <path d="M5 12l4 4 10-10" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<CoreEntity[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  // Display only: the five newest rows for Recent Activity. No money on this
  // page is summed from transactions — see the Portfolio Summary below.
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [awaitingReviewCount, setAwaitingReviewCount] = useState(0);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [sortBy, setSortBy] = useState<string>("name-asc");
  const [pageSize, setPageSize] = useState<string>("20");
  const [cashFlowView, setCashFlowView] = useState<'graph' | 'table'>('graph');
  const [cashFlowYear, setCashFlowYear] = useState(() => currentFinancialYear());
  const [cashFlowPickerOpen, setCashFlowPickerOpen] = useState(false);

  // Mobile layout state
  const [isMobile, setIsMobile] = useState(false);
  const [propertySearchQuery, setPropertySearchQuery] = useState("");
  const [selectedEntityFilter, setSelectedEntityFilter] = useState("all");
  const searchParams = useSearchParams();
  const viewParam = searchParams?.get('view') || 'home';
  const tabParam = searchParams?.get('tab') || (viewParam === 'entity' ? 'detailed' : 'summary');

  const activeMobileView = viewParam as 'home' | 'activity' | 'property' | 'entity' | 'insights';
  const activeTab = tabParam as 'summary' | 'detailed';

  // The Add pages' Back link returns here, to the same phone tab. Passed
  // explicitly so it never depends on the layout's path history.
  const dashboardQuery = searchParams?.toString() ?? "";
  const dashboardHref = `/dashboard/client${dashboardQuery ? `?${dashboardQuery}` : ""}`;
  const addTransactionHref = `/dashboard/client/transactions/new?${new URLSearchParams({
    backHref: dashboardHref,
    backLabel: "Dashboard",
  })}`;
  const addPropertyHref = `/dashboard/client/properties/new?${new URLSearchParams({
    backUrl: dashboardHref,
    backText: "Dashboard",
  })}`;

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // The Cash Flow year picker closes on any outside click (its own button
  // stops propagation).
  useEffect(() => {
    if (!cashFlowPickerOpen) return;
    const close = () => setCashFlowPickerOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [cashFlowPickerOpen]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        let token: string;
        try {
          token = await getIdToken();
        } catch {
          router.replace("/login/user");
          return;
        }
        const headers = { Authorization: `Bearer ${token}` };

        // Independent reads, so they go out together instead of one after
        // another. The user is the layout's in-flight request, not a second
        // one. Recent Activity needs only the five newest rows; the review
        // badge needs only the queue's total.
        const [userResult, entitiesResult, recentResult, queueResult] =
          await Promise.allSettled([
            fetchCurrentUser(token),
            fetch("/api/entities", { headers }),
            fetch("/api/transactions?limit=5&sort=date&dir=desc", { headers }),
            fetch("/api/transactions?review_status=unreviewed&limit=1", { headers }),
          ]);
        if (cancelled) return;

        if (userResult.status === "fulfilled") {
          setCurrentUser(userResult.value);
        } else {
          console.error("Failed to fetch current user:", userResult.reason);
        }

        if (entitiesResult.status === "fulfilled" && entitiesResult.value.ok) {
          const data = (await entitiesResult.value.json()) as { items?: CoreEntity[] };
          if (cancelled) return;
          const loadedEntities = data.items || [];
          setEntities(loadedEntities);
          setProperties(loadedEntities.flatMap((entity: any) => entity.properties || []));
        } else {
          const data =
            entitiesResult.status === "fulfilled"
              ? await entitiesResult.value.json().catch(() => ({}))
              : {};
          if (cancelled) return;
          setErrorMessage(data.error || "Failed to load your entities.");
        }

        if (recentResult.status === "fulfilled" && recentResult.value.ok) {
          const data = await recentResult.value.json();
          if (!cancelled) setRecentTransactions(data.items || []);
        }
        if (queueResult.status === "fulfilled" && queueResult.value.ok) {
          const data = await queueResult.value.json();
          if (!cancelled) setAwaitingReviewCount(Number(data.total) || 0);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load client entities:", error);
          setErrorMessage("Unexpected error loading your workspace.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  // ---------------------------------------------------------------------------
  // Money. Every figure below comes from the Portfolio Summary — the same
  // server aggregate as the Reports page: gross, at each property's share of a
  // split bill, unreviewed rows excluded, for the financial year. The page used
  // to sum one 50-row page of transactions in the browser (net in some places,
  // gross in others, unreviewed rows included), which undercounted as soon as
  // a client had more than 50 rows. Last year's summary supplies the months
  // before 1 July (the 6-month chart, July's month-on-month badge) and the
  // Last Financial Year cards.
  // ---------------------------------------------------------------------------
  const clientId = currentUser?.id || null;
  const financialYear = currentFinancialYear();
  const summaryRegion = usePortfolioSummary(clientId, financialYear);
  const lastYearRegion = usePortfolioSummary(clientId, financialYear - 1);
  const summary = summaryRegion.data;
  const lastYear = lastYearRegion.data;
  const totals = summary?.totals ?? null;
  const hasSummary = summary !== null;
  /** Exact money (to the cent, never "12.3K"), or "—" while the summary is missing (never a fake zero). */
  const money = (value: number | null | undefined) =>
    hasSummary && value != null ? formatExactCurrency(value) : "—";

  const now = new Date();
  const monthsByKey = monthIndex(lastYear, summary);
  const thisMonth = monthAt(monthsByKey, monthKey(now));
  const previousMonth = monthAt(monthsByKey, monthKey(shiftMonth(now, -1)));

  const displayIncomeThisMonth = thisMonth.income;
  const displayExpenseThisMonth = thisMonth.expenses;
  const displayCashFlow = displayIncomeThisMonth - displayExpenseThisMonth;
  // Interest only: principal repayments are not recorded anywhere, so a
  // "repayments" figure would be a guess (it used to be a keyword match on
  // category names).
  const displayInterestThisMonth = thisMonth.interest;

  const cashFlowChange = percentChange(
    displayCashFlow,
    previousMonth.income - previousMonth.expenses,
  );
  const incomeChange = percentChange(displayIncomeThisMonth, previousMonth.income);
  const expenseChange = percentChange(displayExpenseThisMonth, previousMonth.expenses);

  // Cash Flow: one financial year, July to June, picked on the card (and in
  // its View Detail overlay — the same state). This year and last reuse the
  // summaries above; only an older year fetches its own.
  const isOlderCashFlowYear = cashFlowYear < financialYear - 1;
  const olderYearRegion = usePortfolioSummary(
    isOlderCashFlowYear ? clientId : null,
    cashFlowYear,
  );
  const cashFlowRegion =
    cashFlowYear === financialYear
      ? summaryRegion
      : cashFlowYear === financialYear - 1
        ? lastYearRegion
        : olderYearRegion;
  const cashFlowSummary = cashFlowRegion.data;
  const cashFlowLoading = cashFlowRegion.status === "loading" && !cashFlowSummary;
  const cashFlowError =
    cashFlowRegion.status === "error" && !cashFlowSummary
      ? `Couldn't load ${fyLongLabel(cashFlowYear)}. ${cashFlowRegion.error ?? ""}`.trim()
      : null;
  // Years with data, plus this year and the one on screen, so the picker
  // never hides the selected year (the Reports page's rule).
  const cashFlowYearOptions = [
    ...new Set<number>([
      financialYear,
      cashFlowYear,
      ...(summary?.availableFinancialYears ?? []),
    ]),
  ].sort((a, b) => b - a);

  const cashFlowMonthsByKey = monthIndex(cashFlowSummary);
  const chartMonthKeys = fyMonthKeys(cashFlowYear);
  const displayMonths = chartMonthKeys.map(monthShortLabel);
  const displayIncome = chartMonthKeys.map((key) => monthAt(cashFlowMonthsByKey, key).income);
  const displayExpense = chartMonthKeys.map((key) => monthAt(cashFlowMonthsByKey, key).expenses);
  const hasChartData = displayIncome.some((v) => v > 0) || displayExpense.some((v) => v > 0);

  const maxMonthSum = Math.max(...displayIncome.map((inc, idx) => inc + displayExpense[idx]), 1);

  // Balance sheet: latest recorded values, loans at each property's
  // allocation — the Reports page's figures, not a raw sum of loan amounts.
  const displayMarketValue = totals?.marketValue ?? 0;
  const displayOutstandingLoans = totals?.loanBalance ?? 0;
  const displayNetPosition = totals?.netEquity ?? 0;
  const displayLoansValue = displayOutstandingLoans;

  const expenseCategories = (cashFlowSummary?.expensesByCategory ?? [])
    .filter((line) => line.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((line) => ({ name: line.categoryName || "Uncategorised", amount: line.amount }));
  const incomeSources = (cashFlowSummary?.incomeByCategory ?? [])
    .filter((line) => line.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map((line) => ({ name: line.categoryName || "Uncategorised", amount: line.amount }));

  const lastYearTotals = lastYear?.totals ?? null;

  // The figures are one region: if the summary (or the entity list) fails,
  // the page says so once, with Retry, and every figure shows "—".
  const figuresError =
    summaryRegion.status === "error"
      ? `Couldn't load your figures. ${summaryRegion.error ?? ""}`.trim()
      : errorMessage;
  const retryFigures = () => {
    summaryRegion.reload();
    lastYearRegion.reload();
  };
  // Hold the skeleton until the first summary arrives, so the cards never
  // flash zeros before the real numbers.
  const figuresLoading =
    isLoading || (clientId !== null && summaryRegion.status === "loading" && !summary);

  const activityItems = recentTransactions.map(tx => ({
    id: tx.id,
    description: tx.description || `${transactionTypeLabel(tx.type)} - ${tx.categoryName}`,
    categoryName: tx.categoryName,
    meta: tx.propertyName || tx.propertyNames?.[0] || titleCase(tx.type),
    type: tx.type,
    amount: Math.abs(tx.netAmount || tx.grossAmount || 0),
    awaitingReview: isAwaitingReview(tx.reviewStatus),
    awaitingExtraction: isAwaitingExtraction(tx.metadata),
  }));

  // By Entity / By Property rows come straight from the summary, which lists
  // every live entity and property even when it has no activity this year.
  // Until it arrives (or if it fails) the lists fall back to names only, with
  // "—" for every figure.
  const entityListItems = summary
    ? summary.entities.map((entity) => ({
        id: entity.entityId,
        name: entity.name,
        propertiesCount: entity.propertyCount,
        marketValue: entity.marketValue as number | null,
        outstandingLoans: entity.loanBalance as number | null,
        netPosition: entity.equity as number | null,
        loanPercentage: entity.lvrPercent ?? 0,
        isReal: true,
      }))
    : entities.map((entity) => ({
        id: entity.id,
        name: entity.name,
        propertiesCount: properties.filter((p) => p.entityId === entity.id).length,
        marketValue: null as number | null,
        outstandingLoans: null as number | null,
        netPosition: null as number | null,
        loanPercentage: 0,
        isReal: true,
      }));

  const propertyListItems = summary
    ? summary.properties.map((row) => {
        const prop = properties.find((p) => p.id === row.propertyId);
        return {
          id: row.propertyId,
          name: row.name,
          entityName: row.entityName,
          marketValue: row.marketValue,
          outstandingLoans: row.loanBalance,
          income: row.income as number | null,
          expense: row.expenses as number | null,
          depreciation: row.depreciation,
          // Net after depreciation — the Reports page's By Property figure.
          net: row.netResult as number | null,
          status: prop?.status || "Rented",
          imageUrl: prop?.imageUrl || null,
          isReal: true,
          entityId: row.entityId,
        };
      })
    : properties.map((prop) => ({
        id: prop.id as string,
        name: prop.name as string,
        entityName: entities.find((e) => e.id === prop.entityId)?.name ?? "",
        marketValue: null as number | null,
        outstandingLoans: null as number | null,
        income: null as number | null,
        expense: null as number | null,
        depreciation: 0,
        net: null as number | null,
        status: prop.status || "Rented",
        imageUrl: prop.imageUrl || null,
        isReal: true,
        entityId: prop.entityId as string,
      }));

  // Filter properties by search query and selected entity
  let filteredProperties = propertyListItems;
  if (selectedEntityFilter !== 'all') {
    filteredProperties = filteredProperties.filter(
      p => p.entityId === selectedEntityFilter || p.entityName === selectedEntityFilter
    );
  }
  if (propertySearchQuery.trim()) {
    const q = propertySearchQuery.toLowerCase();
    filteredProperties = filteredProperties.filter(
      p => p.name.toLowerCase().includes(q) || p.entityName.toLowerCase().includes(q)
    );
  }

  // Calculate portfolio metrics
  const portfolioValueSum = filteredProperties.reduce((sum, p) => sum + (p.marketValue ?? 0), 0);
  const portfolioNetSum = filteredProperties.reduce((sum, p) => sum + (p.net ?? 0), 0);
  const calculatedReturnRate = portfolioValueSum > 0 ? (portfolioNetSum / portfolioValueSum) * 100 : 0;

  const portfolioAvgReturn = calculatedReturnRate;

  // Entities list for properties filter row
  const propertiesEntityPills = [
    { id: 'all', name: 'All Entities' },
    ...entities.map(e => ({ id: e.id, name: e.name }))
  ];

  // The summary's LVR / equity split (null when there is no value to divide by).
  const loanPercentageOverall = Math.min(Math.max(totals?.lvrPercent ?? 0, 0), 100);
  const equityPercentageOverall = totals?.equityPercent != null ? 100 - loanPercentageOverall : 0;



  // Sort and filter displayed entities for Detailed tab
  const sortedEntities = [...entities].sort((a, b) => {
    if (sortBy === "name-asc") {
      return a.name.localeCompare(b.name);
    } else if (sortBy === "name-desc") {
      return b.name.localeCompare(a.name);
    } else if (sortBy === "date-desc") {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    } else if (sortBy === "date-asc") {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    }
    return 0;
  });

  const limit = pageSize === "all" ? entities.length : Number(pageSize);
  const displayedEntities = sortedEntities.slice(0, limit);

  // User Greeting values
  const firstWord = (str: string) => str ? str.split(/[\s,]+/)[0] : "";
  const userName = currentUser?.fullName ? firstWord(currentUser.fullName) : (currentUser?.email ? titleCase(currentUser.email.split("@")[0]) : "");
  const userInitials = currentUser?.fullName ? getInitials(currentUser.fullName) : (currentUser?.email ? getInitials(currentUser.email) : "");

  function getInitials(value: string) {
    if (!value) return "";
    const localPart = value.split("@")[0] || value;
    const parts = localPart.split(/[._-]/).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return localPart.slice(0, 2).toUpperCase();
  }

  const getOrdinalNum = (number: number) => {
    let selector = (number % 100);
    if (selector >= 11 && selector <= 13) return number + "th";
    switch (number % 10) {
      case 1: return number + "st";
      case 2: return number + "nd";
      case 3: return number + "rd";
      default: return number + "th";
    }
  };

  const day = new Date().getDate();
  const monthName = new Date().toLocaleDateString("en-US", { month: "long" });
  const ordinalDate = `${getOrdinalNum(day)} of ${monthName}`;



  if (isMobile) {
    return (
      <Skeleton
        name="client-portfolio-page"
        loading={figuresLoading}
        fallback={<ClientPortfolioSkeleton isMobile={true} activeTab={activeTab} activeMobileView={activeMobileView} />}
      >
        <div className="mobile-client-dashboard">
          {/* Header */}
          <div className="m-db-header">
            <div className="m-db-profile-section">
              <div className="m-db-logo-box" />
              <div className="m-db-profile-info">
                <p className="m-db-kicker">Good morning</p>
                <h2 className="m-db-name">{userName}</h2>
              </div>
            </div>
            <div className="m-db-actions-section">
              <ThemeToggle />
              <Link href="/dashboard/client/profile" className="m-db-avatar-circle" style={{ textDecoration: 'none' }}>
                {userInitials}
              </Link>
            </div>
          </div>

          {/* Tab switches */}
          <div className="m-db-toggle-wrap">
            <div className="m-db-toggle">
              <button
                type="button"
                className={`m-db-toggle-btn${activeTab === 'summary' ? ' is-active' : ''}`}
                onClick={() => {
                  router.push('/dashboard/client');
                }}
              >
                Summary
              </button>
              <button
                type="button"
                className={`m-db-toggle-btn${activeTab === 'detailed' ? ' is-active' : ''}`}
                onClick={() => {
                  router.push('/dashboard/client?view=entity&tab=detailed');
                }}
              >
                Detailed
              </button>
            </div>
          </div>

          {figuresError && (
            <div style={{ padding: '0 16px' }}>
              <RegionError message={figuresError} onRetry={retryFigures} />
            </div>
          )}

          {/* Content views */}
          {activeTab === 'summary' && activeMobileView === 'home' && (
            <div className="m-db-content">
              {/* Net Position Card */}
              <div className="m-db-net-card">
                <div className="m-db-net-label-row">
                  <span className="m-db-net-label">Net Position</span>
                  <span className="m-db-net-date-badge">As of {ordinalDate}</span>
                </div>
                <div className="m-db-net-value">{money(displayNetPosition)}</div>
                <div className="m-db-net-divider" />
                <div className="m-db-net-stats-row">
                  <div className="m-db-net-stat-col">
                    <span className="m-db-net-stat-label">Market Value</span>
                    <span className="m-db-net-stat-value">{money(displayMarketValue)}</span>
                  </div>
                  <div className="m-db-net-stat-col">
                    <span className="m-db-net-stat-label">Outstanding Loans</span>
                    <span className="m-db-net-stat-value">{money(displayOutstandingLoans)}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="m-db-actions-grid">
                <Link href="/dashboard/client/entities/new" className="m-db-btn-entity">
                  <div className="m-db-entity-icon-wrap">
                    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '22px', height: '22px', minWidth: '22px', minHeight: '22px', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                      <line x1="3" y1="22" x2="21" y2="22" />
                      <line x1="6" y1="18" x2="6" y2="11" />
                      <line x1="10" y1="18" x2="10" y2="11" />
                      <line x1="14" y1="18" x2="14" y2="11" />
                      <line x1="18" y1="18" x2="18" y2="11" />
                      <polygon points="12 2 20 7 4 7" />
                      <line x1="2" y1="18" x2="22" y2="18" />
                      <line x1="2" y1="7" x2="22" y2="7" />
                    </svg>
                  </div>
                  <span>Create Entity</span>
                </Link>
                <div className="m-db-actions-row">
                  <Link href={addTransactionHref} className="m-db-action-box tx">
                    <div className="m-db-action-icon-wrap">
                      <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '24px', height: '24px', minWidth: '24px', minHeight: '24px', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                        <path d="m15 4 5 4-5 4" />
                        <path d="M20 8H4" />
                        <path d="m9 20-5-4 5-4" />
                        <path d="M4 16h16" />
                      </svg>
                    </div>
                    <span>Add Transaction</span>
                  </Link>

                  <Link
                    href={addPropertyHref}
                    className="m-db-action-box property"
                  >
                    <div className="m-db-action-icon-wrap">
                      <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '24px', height: '24px', minWidth: '24px', minHeight: '24px', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                        <path d="M18 8V3h-3" />
                        <path d="M4.5 11 2 11l10-8.5 10 8.5h-2.5" />
                        <path d="M5 11v8a2 2 0 0 0 2 2h4" />
                        <path d="M9 21v-5a1 1 0 0 1 1-1h2" />
                        <circle cx="17.5" cy="17.5" r="4.5" />
                        <path d="M17.5 15v5" />
                        <path d="M15 17.5h5" />
                      </svg>
                    </div>
                    <span>Add Property</span>
                  </Link>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="m-db-summary-grid">
                <div className="m-db-stat-card">
                  <div className="m-db-stat-header">
                    <div className="m-db-stat-icon-wrap cashflow">
                      <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                      </svg>
                    </div>
                    <TrendBadge change={cashFlowChange} variant="mobile" />
                  </div>
                  <div className="m-db-stat-body">
                    <span className="m-db-stat-label">Cash Flow (This Month)</span>
                    <span className="m-db-stat-value" style={hasSummary ? { color: signedTone(displayCashFlow) } : undefined}>{money(displayCashFlow)}</span>
                  </div>
                </div>

                <div className="m-db-stat-card">
                  <div className="m-db-stat-header">
                    <div className="m-db-stat-icon-wrap loans">
                      <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                        <path d="M3 21h18" />
                        <path d="M3 10h18" />
                        <path d="M5 6h14" />
                        <path d="M4 10v11" />
                        <path d="M20 10v11" />
                      </svg>
                    </div>
                  </div>
                  <div className="m-db-stat-body">
                    <span className="m-db-stat-label">Loans</span>
                    <span className="m-db-stat-value">{money(displayLoansValue)}</span>
                  </div>
                </div>
              </div>

              {/* Last Financial Year Section */}
              <div className="m-db-activity-section" style={{ marginTop: '16px' }}>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-[#101828] dark:text-[var(--text-primary)] text-base font-bold">
                    Last Financial Year
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Net Income Card */}
                  <div className="bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[16px] p-3.5 shadow-sm flex flex-col justify-between gap-3">
                    <div className="flex justify-between items-center">
                      <div className="w-8 h-8 rounded-[8px] bg-[#eefdf4] text-[#12b76a] flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                          <polyline points="17 6 23 6 23 12" />
                        </svg>
                      </div>
                      <span className="bg-[#f2f4f7] dark:bg-[var(--surface-2)] text-[#475467] dark:text-[var(--text-secondary)] px-2 py-0.5 rounded-[4px] text-[10px] font-semibold">
                        {fyShortLabel(financialYear - 1)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[11px] font-medium leading-tight">Net Income (Last FY)</span>
                      <span className="text-[#101828] dark:text-[var(--text-primary)] text-lg font-bold">{lastYearTotals ? formatExactCurrency(lastYearTotals.netIncomeTotal) : "—"}</span>
                      <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[10px]">
                        {lastYearTotals ? `${lastYearTotals.profitCount} propert${lastYearTotals.profitCount === 1 ? "y" : "ies"} in profit` : " "}
                      </span>
                    </div>
                  </div>

                  {/* Net Loss Card */}
                  <div className="bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[16px] p-3.5 shadow-sm flex flex-col justify-between gap-3">
                    <div className="flex justify-between items-center">
                      <div className="w-8 h-8 rounded-[8px] bg-[#fff5f2] text-[#f04438] flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                          <polyline points="17 18 23 18 23 12" />
                        </svg>
                      </div>
                      <span className="bg-[#f2f4f7] dark:bg-[var(--surface-2)] text-[#475467] dark:text-[var(--text-secondary)] px-2 py-0.5 rounded-[4px] text-[10px] font-semibold">
                        {fyShortLabel(financialYear - 1)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[11px] font-medium leading-tight">Net Loss (Last FY)</span>
                      <span className="text-[#101828] dark:text-[var(--text-primary)] text-lg font-bold">{lastYearTotals ? formatExactCurrency(lastYearTotals.netLossTotal) : "—"}</span>
                      <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[10px]">
                        {lastYearTotals ? `${lastYearTotals.lossCount} propert${lastYearTotals.lossCount === 1 ? "y" : "ies"} at a loss` : " "}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stacked Bar Chart Card */}
              <div className="m-db-chart-card">
                <div className="m-db-chart-header">
                  <div>
                    <h3 className="m-db-chart-title">Cash Flow</h3>
                    <div className="m-db-chart-subtitle">
                      <span>Income vs expense</span>
                      <span className="m-db-chart-dot" />
                      <span>{fyShortLabel(cashFlowYear)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <FinancialYearPicker
                      value={cashFlowYear}
                      onChange={setCashFlowYear}
                      isOpen={cashFlowPickerOpen}
                      setIsOpen={setCashFlowPickerOpen}
                      years={cashFlowYearOptions}
                    />
                    <div className="m-db-chart-legend">
                      <div className="m-db-legend-item">
                        <div className="m-db-legend-color income" />
                        <span>Income</span>
                      </div>
                      <div className="m-db-legend-item">
                        <div className="m-db-legend-color expense" />
                        <span>Expenses</span>
                      </div>
                    </div>
                  </div>
                </div>
                {cashFlowError ? (
                  <RegionError message={cashFlowError} onRetry={cashFlowRegion.reload} />
                ) : cashFlowLoading ? (
                  <div className="flex items-center justify-center text-sm text-[#667085]" style={{ minHeight: '150px' }}>
                    Loading {fyLongLabel(cashFlowYear)}…
                  </div>
                ) : !hasChartData ? (
                  <div className="flex flex-col items-center justify-center text-center p-6 text-[#667085]" style={{ minHeight: '150px' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '32px', height: '32px', color: '#98a2b3' }} className="mb-2">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    <span className="text-sm font-semibold">No cash flow data available</span>
                    <span className="text-xs text-[#98a2b3] mt-1">Record transactions to view the chart.</span>
                  </div>
                ) : (
                  <div className="m-db-chart-bars-wrap is-fy">
                    {displayMonths.map((month, idx) => {
                      const incVal = displayIncome[idx];
                      const expVal = displayExpense[idx];
                      const total = incVal + expVal;

                      const barHeightPct = (total / maxMonthSum) * 100;
                      const incPct = total > 0 ? (incVal / total) * 100 : 0;
                      const expPct = total > 0 ? (expVal / total) * 100 : 0;

                      return (
                        <div key={month} className="m-db-chart-bar-container">
                          <div
                            className="m-db-chart-bar-pill"
                            style={{
                              height: `${barHeightPct}%`,
                              minHeight: '16px'
                            }}
                          >
                            <div className="m-db-chart-bar-income" style={{ height: `${incPct}%` }} title={`Income: ${formatExactCurrency(incVal)}`} />
                            <div className="m-db-chart-bar-expense" style={{ height: `${expPct}%` }} title={`Expense: ${formatExactCurrency(expVal)}`} />
                          </div>
                          <span className="m-db-chart-bar-label">{month}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Activity Card */}
              <div className="m-db-activity-section">
                <div className="m-db-activity-header">
                  <h3 className="m-db-activity-title">
                    Recent activity
                    <ReviewQueueCount count={awaitingReviewCount} />
                  </h3>
                  <button
                    type="button"
                    className="m-db-activity-view-all"
                    onClick={() => router.push('/dashboard/client/transactions')}
                    style={{ background: 'none', border: 'none', padding: 0 }}
                  >
                    View all
                  </button>
                </div>

                <div className="m-db-activity-list-card">
                  {activityItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center text-[#667085]" style={{ minHeight: '120px' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '32px', height: '32px', color: '#98a2b3' }} className="mb-2">
                        <rect x="3" y="4" width="18" height="16" rx="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <span className="text-sm font-semibold">No transactions available</span>
                      <span className="text-xs text-[#98a2b3] mt-1">Start by adding a transaction.</span>
                    </div>
                  ) : (
                    activityItems.map((item) => (
                      <div key={item.id} className="m-db-activity-row">
                        <div className="m-db-activity-left">
                          <div className={`m-db-activity-icon-box ${item.type === 'revenue' ? 'income' : 'expense'}`}>
                            {item.type === 'revenue' ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '18px', height: '18px' }}>
                                <line x1="7" y1="17" x2="7" y2="7" />
                                <polyline points="7 7 17 7 17 17" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '18px', height: '18px' }}>
                                <line x1="17" y1="7" x2="7" y2="17" />
                                <polyline points="17 17 7 17 7 7" />
                              </svg>
                            )}
                          </div>
                          <div className="m-db-activity-info">
                            <strong className="m-db-activity-desc">{item.description}</strong>
                            <span className="m-db-activity-meta">
                              {item.categoryName} - {item.meta}
                            </span>
                            <ReviewStatusBadge
                              awaitingReview={item.awaitingReview}
                              awaitingExtraction={item.awaitingExtraction}
                            />
                          </div>
                        </div>
                        <span className={`m-db-activity-amount ${item.type === 'revenue' ? 'income' : 'expense'}`}>
                          {formatExactCurrency(item.type === 'revenue' ? item.amount : -item.amount, { showPlus: true })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Detailed View */}
          {activeTab === 'detailed' && (
            <div className="m-db-content">
              {/* Detailed Net Position Card */}
              <div className="m-db-net-card is-detailed-theme">
                <div className="m-db-net-label-row">
                  <span className="m-db-net-label">Net Position</span>
                  <span className="m-db-net-date-badge">As of {ordinalDate}</span>
                </div>
                <div className="m-db-net-value">{money(displayNetPosition)}</div>
                <div className="m-db-net-divider" />
                <div className="m-db-net-stats-row" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr 1.2fr', gap: '4px' }}>
                  <div className="m-db-net-stat-col" style={{ paddingLeft: 0 }}>
                    <span className="m-db-net-stat-label">Market Value</span>
                    <span className="m-db-net-stat-value">{money(displayMarketValue)}</span>
                  </div>
                  <div className="m-db-net-stat-col" style={{ paddingLeft: '8px' }}>
                    <span className="m-db-net-stat-label">Outstanding Loan</span>
                    <span className="m-db-net-stat-value">{money(displayOutstandingLoans)}</span>
                  </div>
                  <div className="m-db-net-stat-col" style={{ paddingLeft: '8px' }}>
                    <span className="m-db-net-stat-label">Interest (MTD)</span>
                    <span className="m-db-net-stat-value">{money(displayInterestThisMonth)}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="m-db-actions-grid" style={{ marginTop: '16px' }}>
                <Link href="/dashboard/client/entities/new" className="m-db-btn-entity">
                  <div className="m-db-entity-icon-wrap">
                    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '22px', height: '22px', minWidth: '22px', minHeight: '22px', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                      <line x1="3" y1="22" x2="21" y2="22" />
                      <line x1="6" y1="18" x2="6" y2="11" />
                      <line x1="10" y1="18" x2="10" y2="11" />
                      <line x1="14" y1="18" x2="14" y2="11" />
                      <line x1="18" y1="18" x2="18" y2="11" />
                      <polygon points="12 2 20 7 4 7" />
                      <line x1="2" y1="18" x2="22" y2="18" />
                      <line x1="2" y1="7" x2="22" y2="7" />
                    </svg>
                  </div>
                  <span>Create Entity</span>
                </Link>
                <div className="m-db-actions-row">
                  <Link href={addTransactionHref} className="m-db-action-box tx">
                    <div className="m-db-action-icon-wrap">
                      <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '24px', height: '24px', minWidth: '24px', minHeight: '24px', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                        <path d="m15 4 5 4-5 4" />
                        <path d="M20 8H4" />
                        <path d="m9 20-5-4 5-4" />
                        <path d="M4 16h16" />
                      </svg>
                    </div>
                    <span>Add Transaction</span>
                  </Link>

                  <Link
                    href={addPropertyHref}
                    className="m-db-action-box property"
                  >
                    <div className="m-db-action-icon-wrap">
                      <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '24px', height: '24px', minWidth: '24px', minHeight: '24px', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                        <path d="M18 8V3h-3" />
                        <path d="M4.5 11 2 11l10-8.5 10 8.5h-2.5" />
                        <path d="M5 11v8a2 2 0 0 0 2 2h4" />
                        <path d="M9 21v-5a1 1 0 0 1 1-1h2" />
                        <circle cx="17.5" cy="17.5" r="4.5" />
                        <path d="M17.5 15v5" />
                        <path d="M15 17.5h5" />
                      </svg>
                    </div>
                    <span>Add Property</span>
                  </Link>
                </div>
              </div>

              {/* Loans & Interest Section */}
              <div className="m-db-activity-section" style={{ marginTop: '16px' }}>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-[#101828] dark:text-[var(--text-primary)] text-base font-bold">
                    Loans & Interest
                  </h3>
                  <Link href="/dashboard/client/properties" className="text-[#175cd3] dark:text-[#53b1fd] text-xs font-bold hover:underline">
                    View all
                  </Link>
                </div>

                <div className="flex flex-col gap-3">
                  {/* Overall Interest Card */}
                  <div className="bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[16px] p-4 shadow-sm flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[8px] bg-[#eff4ff] text-[#3538cd] flex items-center justify-center font-bold text-sm">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                            <line x1="19" y1="5" x2="5" y2="19" />
                            <circle cx="6.5" cy="6.5" r="2.5" />
                            <circle cx="17.5" cy="17.5" r="2.5" />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[11px] font-medium">Interest ({fyShortLabel(financialYear)})</span>
                          <span className="text-[#101828] dark:text-[var(--text-primary)] text-xl font-bold">{money(totals?.interest)}</span>
                        </div>
                      </div>
                      <span className="bg-[#f8f9fc] dark:bg-[var(--surface-2)] border border-[#eaecf0] dark:border-[var(--border)] text-[#344054] dark:text-[var(--text-secondary)] px-2 py-0.5 rounded-[4px] text-[10px] font-semibold">
                        {totals?.lvrPercent != null ? `LVR ${formatClientPercent(totals.lvrPercent)}` : "LVR —"}
                      </span>
                    </div>
                    {/* Rates, fixed/variable splits and redraw are not recorded
                        anywhere, so they are not shown (they were hardcoded). */}
                    <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[10px]">
                      Loan interest recorded this financial year · {money(displayOutstandingLoans)} outstanding
                    </span>
                  </div>
                </div>
              </div>

              {/* By Entity Section */}
              <div className="m-db-activity-section" style={{ marginTop: '16px' }}>
                <div className="m-db-activity-header">
                  <h3 className="m-db-activity-title">By Entity</h3>
                  {entities.length > 0 && (
                    <button
                      type="button"
                      className="m-db-activity-view-all"
                      onClick={() => router.push('/dashboard/client/entities')}
                      style={{ background: 'none', border: 'none', padding: 0 }}
                    >
                      View all
                    </button>
                  )}
                </div>

                <div className="m-db-activity-list-card">
                  {entityListItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center text-[#667085]" style={{ minHeight: '120px' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '32px', height: '32px', color: '#98a2b3' }} className="mb-2">
                        <path d="M3 21h18" />
                        <path d="M3 10h18" />
                        <path d="M5 6h14" />
                        <path d="M4 10v11" />
                        <path d="M20 10v11" />
                      </svg>
                      <span className="text-sm font-semibold">No entities available</span>
                      <span className="text-xs text-[#98a2b3] mt-1">Create an entity to get started.</span>
                    </div>
                  ) : (
                    entityListItems.map((item) => (
                      <div key={item.id} className="m-db-entity-row">
                        <div className="m-db-entity-row-top">
                          <Link
                            href={`/dashboard/client/entities/${item.id}`}
                            className="m-db-entity-name"
                            style={{ textDecoration: 'none' }}
                          >
                            {item.name}
                          </Link>
                          <span className={`m-db-entity-net ${toneClass(item.netPosition)}`}>
                            {money(item.netPosition)}
                          </span>
                        </div>

                        <p className="m-db-entity-subtitle">
                          {item.propertiesCount} propert{item.propertiesCount === 1 ? 'y' : 'ies'}
                        </p>

                        <div className="m-db-entity-bar-container">
                          <div
                            className="m-db-entity-bar-fill"
                            style={{ width: `${Math.min(item.loanPercentage, 100)}%` }}
                          />
                        </div>

                        <div className="m-db-entity-label-row">
                          <span>Value <strong style={{ color: 'var(--text-primary)' }}>{money(item.marketValue)}</strong></span>
                          <span>Loan <strong style={{ color: 'var(--text-primary)' }}>{money(item.outstandingLoans)}</strong></span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* By Property Section */}
              <div className="m-db-activity-section" style={{ marginTop: '16px' }}>
                <div className="m-db-activity-header">
                  <h3 className="m-db-activity-title">By Property</h3>
                  {properties.length > 0 && (
                    <button
                      type="button"
                      className="m-db-activity-view-all"
                      onClick={() => router.push('/dashboard/client/properties')}
                      style={{ background: 'none', border: 'none', padding: 0 }}
                    >
                      View all
                    </button>
                  )}
                </div>

                <div className="m-db-activity-list-card">
                  {propertyListItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center text-[#667085] dark:text-[#8891C4]" style={{ minHeight: '120px' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '32px', height: '32px', color: 'var(--text-muted)' }} className="mb-2">
                        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <path d="M9 22V12h6v10" />
                      </svg>
                      <span className="text-sm font-semibold">No properties available</span>
                      <span className="text-xs text-[#98a2b3] dark:text-[#6F76A6] mt-1">Add a property to start tracking.</span>
                    </div>
                  ) : (
                    propertyListItems.map((item, idx) => (
                      <div key={`${item.id}-${idx}`} style={{ display: 'flex', flexDirection: 'column', padding: '16px', borderBottom: idx < propertyListItems.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {item.isReal ? (
                              <Link
                                href={`/dashboard/client/properties/${item.id}`}
                                className="m-db-entity-name"
                                style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: '15px', fontWeight: 700 }}
                              >
                                {item.name}
                              </Link>
                            ) : (
                              <span style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 700 }}>{item.name}</span>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '12px', height: '12px', flexShrink: 0 }}>
                                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                              </svg>
                              <Link
                                href={`/dashboard/client/entities/${item.entityId}`}
                                style={{ textDecoration: 'none', color: 'var(--text-secondary)' }}
                              >
                                {item.entityName}
                              </Link>
                            </div>
                          </div>

                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }}>
                            <path d="m9 18 6-6-6-6" />
                          </svg>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          <span>Value <strong style={{ color: 'var(--text-primary)' }}>{money(item.marketValue)}</strong></span>
                          <span>Loan <strong style={{ color: 'var(--text-primary)' }}>{money(item.outstandingLoans)}</strong></span>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '16px', rowGap: '4px', marginTop: '8px', fontSize: '12px', fontWeight: 600 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Income <strong style={{ color: 'var(--success)' }}>{item.income != null ? formatExactCurrency(item.income, { showPlus: true }) : "—"}</strong></span>
                          <span style={{ color: 'var(--text-secondary)' }}>Expense <strong style={{ color: 'var(--text-primary)' }}>{item.expense != null ? formatExactCurrency(-item.expense) : "—"}</strong></span>
                          {item.depreciation > 0 && (
                            <span style={{ color: 'var(--text-secondary)' }}>Depreciation <strong style={{ color: 'var(--text-primary)' }}>{formatExactCurrency(-item.depreciation)}</strong></span>
                          )}
                          <span style={{ color: 'var(--text-secondary)' }}>Net <strong style={{ color: item.net != null ? signedTone(item.net) : 'var(--text-primary)' }}>{item.net != null ? formatExactCurrency(item.net, { showPlus: true }) : "—"}</strong></span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="m-db-stat-card" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', borderRadius: '16px', background: 'var(--surface-1)', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(16, 24, 40, 0.01)' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Loan vs Value</h3>

                <div style={{ display: 'flex', height: '8px', width: '100%', borderRadius: '4px', overflow: 'hidden', background: 'var(--surface-2)', margin: '4px 0' }}>
                  <div style={{ width: `${loanPercentageOverall}%`, background: 'var(--brand)', transition: 'width 0.3s ease' }} />
                  <div style={{ width: `${equityPercentageOverall}%`, background: 'var(--accent)', transition: 'width 0.3s ease' }} />
                </div>

                <div style={{ display: 'flex', gap: '16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--brand)' }} />
                    <span>Loan</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--accent)' }} />
                    <span>Equity</span>
                  </div>
                </div>
              </div>

              {/* Reports live in Insights → Reports on a phone; a shortcut from home. */}
              <Link
                href="/dashboard/client/insights?tab=reports"
                className="m-db-stat-card"
                style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '16px', borderRadius: '16px', background: 'var(--surface-1)', border: '1px solid var(--border)', textDecoration: 'none' }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Reports</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Profit &amp; Loss, Depreciation, GST and Portfolio Summary, as PDFs</span>
                </span>
                <span aria-hidden="true" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-secondary)' }}>→</span>
              </Link>
            </div>
          )}
        </div>
      </Skeleton>
    );
  }

  // Original desktop return
  return (
    <Skeleton
      name="client-portfolio-page"
      loading={figuresLoading}
      fallback={<ClientPortfolioSkeleton isMobile={false} activeTab={activeTab} activeMobileView={activeMobileView} />}
    >
      <div className="desktop-client-dashboard">

        {/* Quick Actions Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href={addTransactionHref}
            className="flex items-center justify-center gap-2.5 py-4 px-6 rounded-xl font-semibold transition-all duration-200 hover:scale-[1.01]"
            style={{
              background: 'linear-gradient(135deg, #ffd36f 0%, #f7a61a 100%)',
              color: '#1b265c',
              boxShadow: '0 4px 15px rgba(247, 166, 26, 0.15)',
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '18px', height: '18px', minWidth: '18px', minHeight: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <path d="m16 3 4 4-4 4" />
              <path d="M20 7H4" />
              <path d="m8 21-4-4 4-4" />
              <path d="M4 17h16" />
            </svg>
            Add transaction
          </Link>

          <Link
            href={addPropertyHref}
            className="flex items-center justify-center gap-2.5 py-4 px-6 rounded-xl font-semibold transition-all duration-200 hover:scale-[1.01]"
            style={{
              background: 'linear-gradient(135deg, #ffd36f 0%, #f7a61a 100%)',
              color: '#1b265c',
              boxShadow: '0 4px 15px rgba(247, 166, 26, 0.15)',
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '18px', height: '18px', minWidth: '18px', minHeight: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <path d="M5 12l-2 0l9-9l9 9l-2 0" />
              <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
              <path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6" />
              <path d="M19 10v-6h-3" />
            </svg>
            Add property
          </Link>

          <Link
            href="/dashboard/client/entities/new"
            className="flex items-center justify-center gap-2.5 py-4 px-6 rounded-xl font-semibold transition-all duration-200 hover:scale-[1.01]"
            style={{
              background: 'linear-gradient(135deg, #ffd36f 0%, #f7a61a 100%)',
              color: '#1b265c',
              boxShadow: '0 4px 15px rgba(247, 166, 26, 0.15)',
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '18px', height: '18px', minWidth: '18px', minHeight: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <path d="M7 8c0-2.8 2.2-5 5-5s5 2.2 5 5" />
              <path d="M3 8h18" />
              <path d="M4 8v12" />
              <path d="M20 8v12" />
              <path d="M3 20h18" />
              <path d="M8 12v4" />
              <path d="M12 12v4" />
              <path d="M16 12v4" />
            </svg>
            Create entity
          </Link>
        </div>

        {figuresError && (
          <RegionError message={figuresError} onRetry={retryFigures} />
        )}

        {/* Net Equity Card */}
        <div className="m-db-net-card" style={{ width: '100%' }}>
          <div className="m-db-net-label-row">
            <span className="m-db-net-label" style={{ fontSize: '14px', fontWeight: 600 }}>Net Equity</span>
            <span className="m-db-net-date-badge">As of {ordinalDate}</span>
          </div>
          <div className="m-db-net-value" style={{ fontSize: '42px', fontWeight: 800 }}>
            {money(displayNetPosition)}
          </div>
          <div className="m-db-net-divider" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="m-db-net-stat-col" style={{ borderLeft: 'none', paddingLeft: 0 }}>
              <span className="m-db-net-stat-label">Market Value</span>
              <span className="m-db-net-stat-value" style={{ fontSize: '20px' }}>
                {money(displayMarketValue)}
              </span>
            </div>
            <div className="m-db-net-stat-col" style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.12)', paddingLeft: '20px' }}>
              <span className="m-db-net-stat-label">Outstanding Loans</span>
              <span className="m-db-net-stat-value" style={{ fontSize: '20px' }}>
                {hasSummary ? formatExactCurrency(-displayOutstandingLoans) : "—"}
              </span>
            </div>
            <div className="m-db-net-stat-col" style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.12)', paddingLeft: '20px' }}>
              <span className="m-db-net-stat-label">Interest (This Month)</span>
              <span className="m-db-net-stat-value" style={{ fontSize: '20px' }}>
                {money(displayInterestThisMonth)}
              </span>
            </div>
            <div className="m-db-net-stat-col" style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.12)', paddingLeft: '20px' }}>
              <span className="m-db-net-stat-label">Cash Flow (This Month)</span>
              <span className="m-db-net-stat-value" style={{ fontSize: '20px' }}>
                {hasSummary ? formatExactCurrency(displayCashFlow, { showPlus: true }) : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Mini Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[18px] p-5 flex flex-col gap-3.5 shadow-sm">
            <div className="flex justify-between items-center">
              <div className="w-9 h-9 rounded-[10px] bg-[#eefdf4] text-[#12b76a] flex items-center justify-center">
                <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <TrendBadge change={cashFlowChange} variant="desktop" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs font-medium">Cash Flow (this month)</span>
              <span className="text-xl font-bold" style={{ color: hasSummary ? signedTone(displayCashFlow) : 'var(--text-primary)' }}>{money(displayCashFlow)}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[18px] p-5 flex flex-col gap-3.5 shadow-sm">
            <div className="flex justify-between items-center">
              <div className="w-9 h-9 rounded-[10px] bg-[#eff8ff] text-[#175cd3] flex items-center justify-center">
                <span className="text-base font-bold">$</span>
              </div>
              <TrendBadge change={incomeChange} variant="desktop" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs font-medium">Income (this month)</span>
              <span className="text-[#101828] dark:text-[var(--text-primary)] text-xl font-bold">{money(displayIncomeThisMonth)}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[18px] p-5 flex flex-col gap-3.5 shadow-sm">
            <div className="flex justify-between items-center">
              <div className="w-9 h-9 rounded-[10px] bg-[#fff5f2] text-[#f04438] flex items-center justify-center">
                <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
              </div>
              <TrendBadge change={expenseChange} goodWhenUp={false} variant="desktop" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs font-medium">Expenses (this month)</span>
              <span className="text-[#101828] dark:text-[var(--text-primary)] text-xl font-bold">{money(displayExpenseThisMonth)}</span>
              {summary && summary.excludedUnreviewedCount > 0 && (
                <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[11px]">
                  Excludes {summary.excludedUnreviewedCount} awaiting review
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Section: Last Financial Year */}
        <div className="flex flex-col gap-3.5">
          <div className="flex justify-between items-center">
            <h3 className="text-[#101828] dark:text-[var(--text-primary)] text-base font-bold">
              Last Financial Year
            </h3>
            <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs font-medium">
              {fyShortLabel(financialYear - 1)} · {fyRangeLabel(financialYear - 1)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Net Income Card */}
            <div className="bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[18px] p-5 shadow-sm flex flex-col justify-between gap-4">
              <div className="flex justify-between items-center">
                <div className="w-9 h-9 rounded-[10px] bg-[#eefdf4] text-[#12b76a] flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                </div>
                <span className="bg-[#f2f4f7] dark:bg-[var(--surface-2)] text-[#475467] dark:text-[var(--text-secondary)] px-2.5 py-1 rounded-[6px] text-xs font-semibold">
                  {fyShortLabel(financialYear - 1)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs font-medium">Net Income (Last FY)</span>
                <span className="text-[#101828] dark:text-[var(--text-primary)] text-2xl font-bold">{lastYearTotals ? formatExactCurrency(lastYearTotals.netIncomeTotal) : "—"}</span>
                <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs mt-0.5">
                  {lastYearTotals ? `${lastYearTotals.profitCount} propert${lastYearTotals.profitCount === 1 ? "y" : "ies"} in profit` : " "}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[#f2f4f7] dark:border-[var(--border)] text-xs">
                <Link href="/dashboard/client/reports/portfolio-summary" className="text-[#667085] dark:text-[var(--text-secondary)] font-medium hover:underline">
                  View report
                </Link>
                <span className="text-[#175cd3] dark:text-[#53b1fd] font-semibold">{fyRangeLabel(financialYear - 1)}</span>
              </div>
            </div>

            {/* Net Loss Card */}
            <div className="bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[18px] p-5 shadow-sm flex flex-col justify-between gap-4">
              <div className="flex justify-between items-center">
                <div className="w-9 h-9 rounded-[10px] bg-[#fff5f2] text-[#f04438] flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                    <polyline points="17 18 23 18 23 12" />
                  </svg>
                </div>
                <span className="bg-[#f2f4f7] dark:bg-[var(--surface-2)] text-[#475467] dark:text-[var(--text-secondary)] px-2.5 py-1 rounded-[6px] text-xs font-semibold">
                  {fyShortLabel(financialYear - 1)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs font-medium">Net Loss (Last FY)</span>
                <span className="text-[#101828] dark:text-[var(--text-primary)] text-2xl font-bold">{lastYearTotals ? formatExactCurrency(lastYearTotals.netLossTotal) : "—"}</span>
                <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs mt-0.5">
                  {lastYearTotals ? `${lastYearTotals.lossCount} propert${lastYearTotals.lossCount === 1 ? "y" : "ies"} at a loss` : " "}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[#f2f4f7] dark:border-[var(--border)] text-xs">
                <Link href="/dashboard/client/reports/portfolio-summary" className="text-[#667085] dark:text-[var(--text-secondary)] font-medium hover:underline">
                  View report
                </Link>
                <span className="text-[#175cd3] dark:text-[#53b1fd] font-semibold">{fyRangeLabel(financialYear - 1)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cash Flow. The Payment Alerts card that sat beside it was demo data
            with no backend (no bills or due dates are recorded), so it is gone
            until there is something real to show. */}
        <div className="bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[18px] p-6 shadow-sm flex flex-col gap-4">
          <CashFlowChart
            months={displayMonths}
            income={displayIncome}
            expenses={displayExpense}
            view={cashFlowView}
            onViewChange={setCashFlowView}
            expenseCategories={expenseCategories}
            incomeSources={incomeSources}
            detailPeriodLabel={fyLongLabel(cashFlowYear)}
            financialYear={cashFlowYear}
            financialYearOptions={cashFlowYearOptions}
            onFinancialYearChange={setCashFlowYear}
            loading={cashFlowLoading}
            error={cashFlowError}
            onRetry={cashFlowRegion.reload}
          />
        </div>

        {/* Section: Loans & Interest. Only what is recorded: the loan balance
            (at each property's allocation), LVR and the interest booked to the
            loan-interest account this year and this month. Rates, fixed vs
            variable splits, redraw, principal and due dates are not stored
            anywhere — those cards were hardcoded zeros and are gone. */}
        <div className="flex flex-col gap-3.5">
          <div className="flex justify-between items-center">
            <h3 className="text-[#101828] dark:text-[var(--text-primary)] text-base font-bold">
              Loans & Interest
            </h3>
            <Link href="/dashboard/client/reports/portfolio-summary" className="text-[#175cd3] dark:text-[#53b1fd] text-xs font-bold hover:underline">
              View report
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[18px] p-5 shadow-sm flex flex-col gap-1">
              <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs font-medium">Outstanding loans</span>
              <span className="text-[#101828] dark:text-[var(--text-primary)] text-2xl font-bold">{money(displayOutstandingLoans)}</span>
              <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs">
                {totals ? `${totals.loanCount} loan${totals.loanCount === 1 ? "" : "s"} recorded` : " "}
              </span>
            </div>
            <div className="bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[18px] p-5 shadow-sm flex flex-col gap-1">
              <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs font-medium">Interest ({fyShortLabel(financialYear)})</span>
              <span className="text-[#101828] dark:text-[var(--text-primary)] text-2xl font-bold">{money(totals?.interest)}</span>
              <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs">
                {hasSummary ? `${money(displayInterestThisMonth)} this month` : " "}
              </span>
            </div>
            <div className="bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[18px] p-5 shadow-sm flex flex-col gap-2">
              <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs font-medium">Loan vs value</span>
              <span className="text-[#101828] dark:text-[var(--text-primary)] text-2xl font-bold">
                {totals?.lvrPercent != null ? `LVR ${formatClientPercent(totals.lvrPercent)}` : "—"}
              </span>
              <div className="h-2 w-full rounded-full overflow-hidden flex bg-[#f2f4f7] dark:bg-[var(--surface-2)]">
                <div className="h-full" style={{ width: `${loanPercentageOverall}%`, background: 'var(--brand)' }} />
                <div className="h-full" style={{ width: `${equityPercentageOverall}%`, background: 'var(--accent)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Existing remaining items: Recent Activity and By Property */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Recent Activity card */}
          <div className="col-span-1 bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[18px] p-5 shadow-sm flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-[#101828] dark:text-[var(--text-primary)] text-base font-bold">
                Recent Activity
                <ReviewQueueCount count={awaitingReviewCount} />
              </h3>
            </div>

            <div className="flex flex-col divide-y divide-[#f2f4f7] dark:divide-[var(--border)]">
              {activityItems.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-center text-[#667085] dark:text-[var(--text-secondary)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8 text-[#98a2b3] mb-2" style={{ width: '32px', height: '32px' }}>
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span className="text-sm font-semibold">No transactions available</span>
                  <span className="text-xs text-[#98a2b3] mt-1">Start by adding a transaction.</span>
                </div>
              ) : (
                activityItems.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8.5 h-8.5 rounded-lg flex items-center justify-center flex-shrink-0 ${item.type === 'revenue' ? 'bg-[#ecfdf3] text-[#12b76a]' : 'bg-[#fef3f2] text-[#f04438]'}`}>
                        {item.type === 'revenue' ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '15px', height: '15px' }}>
                            <line x1="7" y1="17" x2="7" y2="7" />
                            <polyline points="7 7 17 7 17 17" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '15px', height: '15px' }}>
                            <line x1="17" y1="7" x2="7" y2="17" />
                            <polyline points="17 17 7 17 7 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <strong className="text-[#101828] dark:text-[var(--text-primary)] text-[13px] font-bold truncate">{item.description}</strong>
                        <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[11px] truncate">
                          {item.categoryName} · {item.meta}
                        </span>
                        <ReviewStatusBadge
                          awaitingReview={item.awaitingReview}
                          awaitingExtraction={item.awaitingExtraction}
                        />
                      </div>
                    </div>
                    <span className={`text-[13px] font-bold flex-shrink-0 ${item.type === 'revenue' ? 'text-[#12b76a]' : 'text-[#f04438]'}`}>
                      {formatExactCurrency(item.type === 'revenue' ? item.amount : -item.amount, { showPlus: true })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* By Property Section */}
          <div className="md:col-span-2 xl:col-span-2 bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[18px] p-5 shadow-sm flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-[#101828] dark:text-[var(--text-primary)] text-base font-bold">By property</h3>
              {properties.length > 0 && (
                <Link href="/dashboard/client/properties" className="text-[#175cd3] dark:text-[#53b1fd] text-xs font-bold hover:underline">
                  View all
                </Link>
              )}
            </div>

            <div className="flex flex-col divide-y divide-[#f2f4f7] dark:divide-[var(--border)]">
              {propertyListItems.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-center text-[#667085] dark:text-[var(--text-secondary)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '32px', height: '32px' }} className="mb-2 text-[#98a2b3]">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <path d="M9 22V12h6v10" />
                  </svg>
                  <span className="text-sm font-semibold">No properties available</span>
                  <span className="text-xs text-[#98a2b3] mt-1">Add a property to start tracking details.</span>
                </div>
              ) : (
                propertyListItems.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="py-4 flex flex-col gap-2.5">
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col min-w-0">
                        {item.isReal ? (
                          <Link
                            href={`/dashboard/client/properties/${item.id}`}
                            className="text-[#101828] dark:text-[var(--text-primary)] text-[14px] font-bold hover:underline truncate"
                          >
                            {item.name}
                          </Link>
                        ) : (
                          <span className="text-[#101828] dark:text-[var(--text-primary)] text-[14px] font-bold truncate">{item.name}</span>
                        )}

                        <div className="flex items-center gap-1.5 mt-1 text-[#667085] dark:text-[var(--text-secondary)] text-[11px]">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '12px', height: '12px', flexShrink: 0 }}>
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                          </svg>
                          <Link
                            href={`/dashboard/client/entities/${item.entityId}`}
                            className="text-[#667085] dark:text-[var(--text-secondary)] hover:underline"
                          >
                            {item.entityName}
                          </Link>
                        </div>
                      </div>

                      {/* Net after depreciation, as on the Reports page. Red
                          when negative — it used to be green whatever the sign. */}
                      <span
                        className="text-[14px] font-bold"
                        style={{ color: item.net != null ? signedTone(item.net) : 'var(--text-primary)' }}
                        title={`Net result, ${fyShortLabel(financialYear)}`}
                      >
                        Net {item.net != null ? formatExactCurrency(item.net, { showPlus: true }) : "—"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-semibold text-[#475467] dark:text-[var(--text-secondary)] mt-1">
                      <span>Value <strong className="text-[#101828] dark:text-[var(--text-primary)]">{money(item.marketValue)}</strong></span>
                      <span>Loan <strong className="text-[#101828] dark:text-[var(--text-primary)]">{money(item.outstandingLoans)}</strong></span>
                      <span>Income <strong className="text-[#12b76a]">{item.income != null ? formatExactCurrency(item.income, { showPlus: true }) : "—"}</strong></span>
                      <span>Expenses <strong className="text-[#f04438]">{item.expense != null ? formatExactCurrency(-item.expense) : "—"}</strong></span>
                      {item.depreciation > 0 && (
                        <span>Depreciation <strong className="text-[#101828] dark:text-[var(--text-primary)]">{formatExactCurrency(-item.depreciation)}</strong></span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </Skeleton>
  );
}
