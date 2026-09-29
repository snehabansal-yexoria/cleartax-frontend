"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useId, useRef } from "react";
import { Skeleton } from "boneyard-js/react";
import ThemeToggle from "@/app/components/ThemeToggle";
import { ClientPortfolioSkeleton } from "@/app/components/PortalSkeletons";
import { logout } from "@/src/lib/logout";
import { getSession } from "@/src/lib/session";
import { formatCurrencyShort, formatClientCurrency } from "@/app/components/clients/CurrencyFormatter";
import type { CoreEntity } from "@/src/lib/coreApi";
import { transactionTypeLabel } from "@/src/lib/transactionTypes";
import { isAwaitingExtraction, isAwaitingReview } from "@/src/lib/reviewStatus";
import {
  ReviewQueueCount,
  ReviewStatusBadge,
} from "@/app/components/ReviewStatusBadge";
import CashFlowChart from "@/app/components/clients/CashFlowChart";
import PaymentAlerts from "@/app/components/clients/PaymentAlerts";
import {
  dropdownRegistryEvent,
  announceDropdownOpen,
  isDropdownRegistryEvent,
} from "@/src/lib/dropdownRegistry";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

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
  const [transactions, setTransactions] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<{ fullName?: string; email?: string } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [sortBy, setSortBy] = useState<string>("name-asc");
  const [pageSize, setPageSize] = useState<string>("20");
  const [cashFlowView, setCashFlowView] = useState<'graph' | 'table'>('graph');

  // Mobile layout state
  const [isMobile, setIsMobile] = useState(false);
  const [propertySearchQuery, setPropertySearchQuery] = useState("");
  const [selectedEntityFilter, setSelectedEntityFilter] = useState("all");
  const searchParams = useSearchParams();
  const viewParam = searchParams?.get('view') || 'home';
  const tabParam = searchParams?.get('tab') || (viewParam === 'entity' ? 'detailed' : 'summary');

  const activeMobileView = viewParam as 'home' | 'activity' | 'property' | 'entity' | 'insights';
  const activeTab = tabParam as 'summary' | 'detailed';

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

        // 1. Fetch current user me info
        try {
          const userRes = await fetch("/api/users/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (userRes.ok) {
            const data = await userRes.json();
            if (!cancelled) setCurrentUser(data);
          }
        } catch (err) {
          console.error("Failed to fetch current user:", err);
        }

        // 2. Fetch entities
        const res = await fetch("/api/entities", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;

        let loadedEntities: CoreEntity[] = [];
        if (res.ok) {
          const data = (await res.json()) as { items?: CoreEntity[] };
          loadedEntities = data.items || [];
          if (!cancelled) setEntities(loadedEntities);
        } else {
          const data = await res.json().catch(() => ({}));
          if (!cancelled) setErrorMessage(data.error || "Failed to load your entities.");
        }

        if (cancelled || loadedEntities.length === 0) {
          if (!cancelled) setIsLoading(false);
          return;
        }

        // 3. Extract aggregated properties from nested entities response
        const allProperties = loadedEntities.flatMap((entity: any) => entity.properties || []);
        if (!cancelled) setProperties(allProperties);

        if (cancelled) return;

        // 4. Fetch transactions
        try {
          const txRes = await fetch("/api/transactions", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (txRes.ok) {
            const data = await txRes.json();
            if (!cancelled) setTransactions(data.items || []);
          }
        } catch (err) {
          console.error("Failed to fetch transactions:", err);
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

  // Calculate metrics
  const marketValue = properties.reduce((sum, prop) => sum + (prop.estimatedMarketValue || 0), 0);
  const outstandingLoans = properties.reduce((sum, prop) => {
    if (!prop.loanDetails) return sum;
    const loanAmt = prop.loanDetails.loan_amount ?? prop.loanDetails.loanAmount ?? prop.loanDetails.amount ?? 0;
    return sum + Number(loanAmt);
  }, 0);
  const netPosition = marketValue - outstandingLoans;

  // Monthly cash flow calculation
  const currentMonthDate = new Date();
  const currentMonth = currentMonthDate.getMonth();
  const currentYear = currentMonthDate.getFullYear();

  const currentMonthTx = transactions.filter(tx => {
    if (!tx.invoiceDate) return false;
    const d = new Date(tx.invoiceDate);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const incomeThisMonth = currentMonthTx
    .filter(tx => tx.type === "revenue")
    .reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);

  const expenseThisMonth = currentMonthTx
    .filter(tx => tx.type === "expense")
    .reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);

  const cashFlowThisMonth = incomeThisMonth - expenseThisMonth;

  // Calculate MTD repayments
  const repaymentsThisMonth = currentMonthTx
    .filter(tx => {
      const cat = (tx.categoryName || "").toLowerCase();
      const subcat = (tx.subcategoryName || "").toLowerCase();
      const desc = (tx.description || "").toLowerCase();
      return (
        cat.includes("repayment") ||
        cat.includes("loan") ||
        subcat.includes("repayment") ||
        subcat.includes("loan") ||
        desc.includes("repayment")
      );
    })
    .reduce((sum, tx) => sum + Math.abs(tx.netAmount || tx.grossAmount || 0), 0);

  const displayRepayments = repaymentsThisMonth;

  // 6 Month historical logic
  const months: string[] = [];
  const incomeHistory: number[] = [];
  const expenseHistory: number[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const m = d.getMonth();
    const y = d.getFullYear();

    const label = d.toLocaleDateString("en-US", { month: "short" });
    months.push(label);

    const txsInMonth = transactions.filter(tx => {
      if (!tx.invoiceDate) return false;
      const txd = new Date(tx.invoiceDate);
      return txd.getMonth() === m && txd.getFullYear() === y;
    });

    const inc = txsInMonth
      .filter(tx => tx.type === "revenue")
      .reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);

    const exp = txsInMonth
      .filter(tx => tx.type === "expense")
      .reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);

    incomeHistory.push(inc);
    expenseHistory.push(exp);
  }

  // Compute actual values based on real data
  const displayMarketValue = marketValue;
  const displayOutstandingLoans = outstandingLoans;
  const displayNetPosition = netPosition;
  const displayCashFlow = cashFlowThisMonth;
  const displayLoansValue = displayOutstandingLoans;
  const displayIncomeThisMonth = incomeThisMonth;
  const displayExpenseThisMonth = expenseThisMonth;

  const displayMonths = months;
  const displayIncome = incomeHistory;
  const displayExpense = expenseHistory;

  const maxMonthSum = Math.max(...displayIncome.map((inc, idx) => inc + displayExpense[idx]), 1);

  const activityItems = transactions.slice(0, 5).map(tx => ({
    id: tx.id,
    description: tx.description || `${transactionTypeLabel(tx.type)} - ${tx.categoryName}`,
    categoryName: tx.categoryName,
    meta: tx.propertyName || tx.propertyNames?.[0] || titleCase(tx.type),
    type: tx.type,
    amount: Math.abs(tx.netAmount || tx.grossAmount || 0),
    awaitingReview: isAwaitingReview(tx.reviewStatus),
    awaitingExtraction: isAwaitingExtraction(tx.metadata),
  }));

  // What the client has sent to their accountant and is still waiting on.
  const awaitingReviewCount = transactions.filter(tx =>
    isAwaitingReview(tx.reviewStatus),
  ).length;

  const entityListItems = entities.map(entity => {
    const entityProperties = properties.filter(p => p.entityId === entity.id);
    const mValue = entityProperties.reduce((sum, p) => sum + (p.estimatedMarketValue || 0), 0);
    const oLoans = entityProperties.reduce((sum, p) => {
      if (!p.loanDetails) return sum;
      const loanAmt = p.loanDetails.loan_amount ?? p.loanDetails.loanAmount ?? p.loanDetails.amount ?? 0;
      return sum + Number(loanAmt);
    }, 0);
    const nPosition = mValue - oLoans;
    const loanPct = mValue > 0 ? (oLoans / mValue) * 100 : 0;
    return {
      id: entity.id,
      name: entity.name,
      propertiesCount: entityProperties.length,
      marketValue: mValue,
      outstandingLoans: oLoans,
      netPosition: nPosition,
      loanPercentage: loanPct,
      isReal: true,
    };
  });

  const propertyListItems = properties.map((prop, idx) => {
    const ent = entities.find(e => e.id === prop.entityId);
    const entName = ent ? ent.name : "Individual";
    const mValue = prop.estimatedMarketValue || 0;
    const oLoans = prop.loanDetails ? Number(prop.loanDetails.loan_amount ?? prop.loanDetails.loanAmount ?? prop.loanDetails.amount ?? 0) : 0;

    const propTxs = transactions.filter(tx => {
      return tx.propertyIds?.includes(prop.id) || tx.propertyNames?.includes(prop.name);
    });

    const inc = propTxs
      .filter(tx => tx.type === "revenue")
      .reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);

    const exp = propTxs
      .filter(tx => tx.type === "expense")
      .reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);

    const netVal = inc - exp;
    const statusVal = prop.status || "Rented";
    const imageUrlVal = prop.imageUrl || null;

    return {
      id: prop.id,
      name: prop.name,
      entityName: entName,
      marketValue: mValue,
      outstandingLoans: oLoans,
      income: inc,
      expense: exp,
      net: netVal,
      status: statusVal,
      imageUrl: imageUrlVal,
      isReal: true,
      entityId: prop.entityId,
    };
  });

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
  const portfolioValueSum = filteredProperties.reduce((sum, p) => sum + p.marketValue, 0);
  const portfolioNetSum = filteredProperties.reduce((sum, p) => sum + p.net, 0);
  const calculatedReturnRate = portfolioValueSum > 0 ? (portfolioNetSum / portfolioValueSum) * 100 : 0;

  const portfolioAvgReturn = calculatedReturnRate;

  // Entities list for properties filter row
  const propertiesEntityPills = [
    { id: 'all', name: 'All Entities' },
    ...entities.map(e => ({ id: e.id, name: e.name }))
  ];

  const loanPercentageOverall = displayMarketValue > 0 ? (displayOutstandingLoans / displayMarketValue) * 100 : 0;
  const equityPercentageOverall = 100 - loanPercentageOverall;



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
  const userName = currentUser?.fullName ? firstWord(currentUser.fullName) : (currentUser?.email ? titleCase(currentUser.email.split("@")[0]) : "Sarah");
  const userInitials = currentUser?.fullName ? getInitials(currentUser.fullName) : (currentUser?.email ? getInitials(currentUser.email) : "SJ");

  function getInitials(value: string) {
    if (!value) return "SJ";
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
        loading={isLoading}
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

          {/* Content views */}
          {activeTab === 'summary' && activeMobileView === 'home' && (
            <div className="m-db-content">
              {/* Net Position Card */}
              <div className="m-db-net-card">
                <div className="m-db-net-label-row">
                  <span className="m-db-net-label">Net Position</span>
                  <span className="m-db-net-date-badge">As of {ordinalDate}</span>
                </div>
                <div className="m-db-net-value">{formatCurrencyShort(displayNetPosition)}</div>
                <div className="m-db-net-divider" />
                <div className="m-db-net-stats-row">
                  <div className="m-db-net-stat-col">
                    <span className="m-db-net-stat-label">Market Value</span>
                    <span className="m-db-net-stat-value">{formatCurrencyShort(displayMarketValue)}</span>
                  </div>
                  <div className="m-db-net-stat-col">
                    <span className="m-db-net-stat-label">Outstanding Loans</span>
                    <span className="m-db-net-stat-value">{formatCurrencyShort(displayOutstandingLoans)}</span>
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
                  <Link href="/dashboard/client/transactions/new" className="m-db-action-box tx">
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
                    href={entities.length > 0 ? `/dashboard/client/properties/new` : "/dashboard/client/properties/new"}
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
                    <span className="m-db-trend-badge up">+12%</span>
                  </div>
                  <div className="m-db-stat-body">
                    <span className="m-db-stat-label">Cash Flow (This Month)</span>
                    <span className="m-db-stat-value">{formatCurrencyShort(displayCashFlow)}</span>
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
                    <span className="m-db-trend-badge down">-2.1%</span>
                  </div>
                  <div className="m-db-stat-body">
                    <span className="m-db-stat-label">Loans</span>
                    <span className="m-db-stat-value">{formatCurrencyShort(displayLoansValue)}</span>
                  </div>
                </div>
              </div>

              {/* Last Financial Year Section */}
              <div className="m-db-activity-section" style={{ marginTop: '16px' }}>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[#101828] dark:text-[var(--text-primary)] text-base font-bold">
                      Last Financial Year
                    </h3>
                    <span className="bg-[#1b265c] text-white px-2 py-0.5 rounded-[4px] text-[10px] font-bold tracking-wider">
                      NEW
                    </span>
                  </div>
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
                        FY 25–26
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[11px] font-medium leading-tight">Net Income (Last FY)</span>
                      <span className="text-[#101828] dark:text-[var(--text-primary)] text-lg font-bold">A$ 0</span>
                      <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[10px]">0 properties in profit</span>
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
                        FY 25–26
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[11px] font-medium leading-tight">Net Loss (Last FY)</span>
                      <span className="text-[#101828] dark:text-[var(--text-primary)] text-lg font-bold">A$ 0</span>
                      <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[10px]">0 properties at a loss</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Alerts Section */}
              <div className="m-db-activity-section">
                <PaymentAlerts />
              </div>

              {/* Stacked Bar Chart Card */}
              <div className="m-db-chart-card">
                <div className="m-db-chart-header">
                  <div>
                    <h3 className="m-db-chart-title">Cash Flow</h3>
                    <div className="m-db-chart-subtitle">
                      <span>Income vs expense</span>
                      <span className="m-db-chart-dot" />
                      <span>6 Months</span>
                    </div>
                  </div>
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
                {transactions.length === 0 ? (
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
                  <div className="m-db-chart-bars-wrap">
                    {displayMonths.map((month, idx) => {
                      const incVal = displayIncome[idx];
                      const expVal = displayExpense[idx];
                      const total = incVal + expVal;

                      const barHeightPct = (total / maxMonthSum) * 100;
                      const incPct = (incVal / total) * 100;
                      const expPct = (expVal / total) * 100;

                      return (
                        <div key={month} className="m-db-chart-bar-container">
                          <div
                            className="m-db-chart-bar-pill"
                            style={{
                              height: `${barHeightPct}%`,
                              minHeight: '16px'
                            }}
                          >
                            <div className="m-db-chart-bar-income" style={{ height: `${incPct}%` }} title={`Income: ${formatCurrencyShort(incVal)}`} />
                            <div className="m-db-chart-bar-expense" style={{ height: `${expPct}%` }} title={`Expense: ${formatCurrencyShort(expVal)}`} />
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
                          {formatClientCurrency(item.type === 'revenue' ? item.amount : -item.amount, { showPlus: true })}
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
                <div className="m-db-net-value">{formatCurrencyShort(displayNetPosition)}</div>
                <div className="m-db-net-divider" />
                <div className="m-db-net-stats-row" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr 1.2fr', gap: '4px' }}>
                  <div className="m-db-net-stat-col" style={{ paddingLeft: 0 }}>
                    <span className="m-db-net-stat-label">Market Value</span>
                    <span className="m-db-net-stat-value">{formatCurrencyShort(displayMarketValue)}</span>
                  </div>
                  <div className="m-db-net-stat-col" style={{ paddingLeft: '8px' }}>
                    <span className="m-db-net-stat-label">Outstanding Loan</span>
                    <span className="m-db-net-stat-value">{formatCurrencyShort(displayOutstandingLoans)}</span>
                  </div>
                  <div className="m-db-net-stat-col" style={{ paddingLeft: '8px' }}>
                    <span className="m-db-net-stat-label">Repayments (MTD)</span>
                    <span className="m-db-net-stat-value">{formatCurrencyShort(displayRepayments)}</span>
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
                  <Link href="/dashboard/client/transactions/new" className="m-db-action-box tx">
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
                    href={entities.length > 0 ? `/dashboard/client/properties/new` : "/dashboard/client/properties/new"}
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
                  <div className="flex items-center gap-2">
                    <h3 className="text-[#101828] dark:text-[var(--text-primary)] text-base font-bold">
                      Loans & Interest
                    </h3>
                    <span className="bg-[#1b265c] text-white px-2 py-0.5 rounded-[4px] text-[10px] font-bold tracking-wider">
                      NEW
                    </span>
                  </div>
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
                          <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[11px] font-medium">Overall Interest (FY 25–26)</span>
                          <span className="text-[#101828] dark:text-[var(--text-primary)] text-xl font-bold">A$ 0</span>
                        </div>
                      </div>
                      <span className="bg-[#f8f9fc] dark:bg-[var(--surface-2)] border border-[#eaecf0] dark:border-[var(--border)] text-[#344054] dark:text-[var(--text-secondary)] px-2 py-0.5 rounded-[4px] text-[10px] font-semibold">
                        0.00% avg p.a.
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="h-2 w-full rounded-full overflow-hidden flex bg-[#f2f4f7] dark:bg-[var(--surface-2)]">
                        <div className="bg-[#1b265c] h-full" style={{ width: '60%' }} />
                        <div className="bg-[#f79009] h-full" style={{ width: '40%' }} />
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-[#344054] dark:text-[var(--text-secondary)] font-medium">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-[2px] bg-[#1b265c] inline-block" />
                          <span>Fixed 0% · A$ 0</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-[2px] bg-[#f79009] inline-block" />
                          <span>Variable 0% · A$ 0</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2-Card Row: Fixed & Variable */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Fixed Interest */}
                    <div className="bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[16px] p-3.5 shadow-sm flex flex-col justify-between gap-3">
                      <div className="flex justify-between items-center">
                        <div className="w-8 h-8 rounded-[8px] bg-[#eff8ff] text-[#175cd3] flex items-center justify-center">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </div>
                        <span className="bg-[#f8f9fc] dark:bg-[var(--surface-2)] border border-[#eaecf0] dark:border-[var(--border)] text-[#344054] dark:text-[var(--text-secondary)] px-1.5 py-0.5 rounded text-[10px] font-semibold">
                          0.00% p.a.
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[11px] font-medium">Fixed Interest</span>
                        <span className="text-[#101828] dark:text-[var(--text-primary)] text-lg font-bold">A$ 0</span>
                      </div>
                      <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[10px]">
                        A$ 0 fixed until Mar 2028
                      </span>
                    </div>

                    {/* Variable Interest */}
                    <div className="bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[16px] p-3.5 shadow-sm flex flex-col justify-between gap-3">
                      <div className="flex justify-between items-center">
                        <div className="w-8 h-8 rounded-[8px] bg-[#fffaf5] text-[#d97706] flex items-center justify-center">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                            <path d="M2 12h5l3 5 4-10 3 5h5" />
                          </svg>
                        </div>
                        <span className="bg-[#fff6ed] dark:bg-[var(--surface-2)] border border-[#ffecd5] dark:border-[var(--border)] text-[#b54708] dark:text-[#f79009] px-1.5 py-0.5 rounded text-[10px] font-semibold">
                          0.00% p.a.
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[11px] font-medium">Variable Interest</span>
                        <span className="text-[#101828] dark:text-[var(--text-primary)] text-lg font-bold">A$ 0</span>
                      </div>
                      <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[10px]">
                        A$ 0 on variable rate
                      </span>
                    </div>
                  </div>

                  {/* Available Redraw Card */}
                  <div className="bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[16px] p-4 shadow-sm flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-[8px] bg-[#eefdf4] text-[#12b76a] flex items-center justify-center flex-shrink-0">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <path d="M7 15h0M2 10h20" />
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[11px] font-medium">Available Redraw</span>
                        <span className="text-[#101828] dark:text-[var(--text-primary)] text-lg font-bold">A$ 0</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-[8px] border border-[#d0d5dd] dark:border-[var(--border)] text-[#344054] dark:text-[var(--text-primary)] text-xs font-semibold hover:bg-[#f8f9fc] dark:hover:bg-[var(--surface-2)] transition-colors"
                    >
                      Redraw
                    </button>
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
                          <span className="m-db-entity-net">{formatCurrencyShort(item.netPosition)}</span>
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
                          <span>Value <strong style={{ color: 'var(--text-primary)' }}>{formatCurrencyShort(item.marketValue)}</strong></span>
                          <span>Loan <strong style={{ color: 'var(--text-primary)' }}>{formatCurrencyShort(item.outstandingLoans)}</strong></span>
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
                                href={`/dashboard/client/entities/${item.entityId}/properties/${item.id}`}
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
                          <span>Value <strong style={{ color: 'var(--text-primary)' }}>{formatCurrencyShort(item.marketValue)}</strong></span>
                          <span>Loan <strong style={{ color: 'var(--text-primary)' }}>{formatCurrencyShort(item.outstandingLoans)}</strong></span>
                        </div>

                        <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '12px', fontWeight: 600 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Income <strong style={{ color: 'var(--success)' }}>{formatClientCurrency(item.income, { short: true, showPlus: true })}</strong></span>
                          <span style={{ color: 'var(--text-secondary)' }}>Expense <strong style={{ color: 'var(--text-primary)' }}>{formatClientCurrency(-item.expense, { short: true })}</strong></span>
                          <span style={{ color: 'var(--text-secondary)' }}>Net <strong style={{ color: item.net >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatClientCurrency(item.net, { short: true, showPlus: true })}</strong></span>
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
      loading={isLoading}
      fallback={<ClientPortfolioSkeleton isMobile={false} activeTab={activeTab} activeMobileView={activeMobileView} />}
    >
      <div className="desktop-client-dashboard">

        {/* Quick Actions Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/dashboard/client/transactions/new"
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
            href={entities.length > 0 ? `/dashboard/client/properties/new` : "/dashboard/client/properties/new"}
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

        {/* Net Equity Card */}
        <div className="m-db-net-card" style={{ width: '100%' }}>
          <div className="m-db-net-label-row">
            <span className="m-db-net-label" style={{ fontSize: '14px', fontWeight: 600 }}>Net Equity</span>
            <span className="m-db-net-date-badge">As of {ordinalDate}</span>
          </div>
          <div className="m-db-net-value" style={{ fontSize: '42px', fontWeight: 800 }}>
            {formatCurrencyShort(displayNetPosition)}
          </div>
          <div className="m-db-net-divider" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="m-db-net-stat-col" style={{ borderLeft: 'none', paddingLeft: 0 }}>
              <span className="m-db-net-stat-label">Market Value</span>
              <span className="m-db-net-stat-value" style={{ fontSize: '20px' }}>
                {formatCurrencyShort(displayMarketValue)}
              </span>
            </div>
            <div className="m-db-net-stat-col" style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.12)', paddingLeft: '20px' }}>
              <span className="m-db-net-stat-label">Outstanding Loans</span>
              <span className="m-db-net-stat-value" style={{ fontSize: '20px' }}>
                {formatClientCurrency(displayOutstandingLoans > 0 ? -displayOutstandingLoans : displayOutstandingLoans, { short: true })}
              </span>
            </div>
            <div className="m-db-net-stat-col" style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.12)', paddingLeft: '20px' }}>
              <span className="m-db-net-stat-label">Repayments (This Month)</span>
              <span className="m-db-net-stat-value" style={{ fontSize: '20px' }}>
                {formatCurrencyShort(displayRepayments)}
              </span>
            </div>
            <div className="m-db-net-stat-col" style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.12)', paddingLeft: '20px' }}>
              <span className="m-db-net-stat-label">Cash Flow (This Month)</span>
              <span className="m-db-net-stat-value" style={{ fontSize: '20px' }}>
                {formatClientCurrency(displayCashFlow, { short: true, showPlus: true })}
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
              <span className="bg-[#ecfdf3] dark:bg-[var(--surface-2)] text-[#027a48] dark:text-[#5dcaa5] px-2 py-0.5 rounded-[20px] text-xs font-semibold">+12%</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs font-medium">Cash Flow (this month)</span>
              <span className="text-[#101828] dark:text-[var(--text-primary)] text-xl font-bold">{formatCurrencyShort(displayCashFlow)}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[18px] p-5 flex flex-col gap-3.5 shadow-sm">
            <div className="flex justify-between items-center">
              <div className="w-9 h-9 rounded-[10px] bg-[#eff8ff] text-[#175cd3] flex items-center justify-center">
                <span className="text-base font-bold">$</span>
              </div>
              <span className="bg-[#ecfdf3] dark:bg-[var(--surface-2)] text-[#027a48] dark:text-[#5dcaa5] px-2 py-0.5 rounded-[20px] text-xs font-semibold">+8.4%</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs font-medium">Income (this month)</span>
              <span className="text-[#101828] dark:text-[var(--text-primary)] text-xl font-bold">{formatCurrencyShort(displayIncomeThisMonth)}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[18px] p-5 flex flex-col gap-3.5 shadow-sm">
            <div className="flex justify-between items-center">
              <div className="w-9 h-9 rounded-[10px] bg-[#fff5f2] text-[#f04438] flex items-center justify-center">
                <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
              </div>
              <span className="bg-[#fef3f2] dark:bg-[var(--surface-2)] text-[#b42318] dark:text-[#f09595] px-2 py-0.5 rounded-[20px] text-xs font-semibold">-3.5%</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs font-medium">Expenses (this month)</span>
              <span className="text-[#101828] dark:text-[var(--text-primary)] text-xl font-bold">{formatCurrencyShort(displayExpenseThisMonth)}</span>
            </div>
          </div>
        </div>

        {/* Section: Last Financial Year */}
        <div className="flex flex-col gap-3.5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h3 className="text-[#101828] dark:text-[var(--text-primary)] text-base font-bold">
                Last Financial Year
              </h3>
              <span className="bg-[#1b265c] text-white px-2 py-0.5 rounded-[4px] text-[10px] font-bold tracking-wider">
                NEW
              </span>
            </div>
            <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs font-medium">
              FY 2025–26 · 1 Jul 2025 – 30 Jun 2026
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
                  FY 25–26
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs font-medium">Net Income (Last FY)</span>
                <span className="text-[#101828] dark:text-[var(--text-primary)] text-2xl font-bold">A$ 0</span>
                <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs mt-0.5">0 properties in profit</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[#f2f4f7] dark:border-[var(--border)] text-xs">
                <span className="text-[#667085] dark:text-[var(--text-secondary)] font-medium">--</span>
                <span className="text-[#175cd3] dark:text-[#53b1fd] font-semibold">1 Jul 2025 – 30 Jun 2026</span>
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
                  FY 25–26
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs font-medium">Net Loss (Last FY)</span>
                <span className="text-[#101828] dark:text-[var(--text-primary)] text-2xl font-bold">A$ 0</span>
                <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs mt-0.5">0 properties at a loss</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[#f2f4f7] dark:border-[var(--border)] text-xs">
                <span className="text-[#667085] dark:text-[var(--text-secondary)] font-medium">--</span>
                <span className="text-[#175cd3] dark:text-[#53b1fd] font-semibold">1 Jul 2025 – 30 Jun 2026</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Grid Sections: Cash Flow & Payment Alerts */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Chart card */}
          <div className="md:col-span-2 xl:col-span-2 bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[18px] p-6 shadow-sm flex flex-col gap-4">
            <CashFlowChart
              months={displayMonths}
              income={displayIncome}
              expenses={displayExpense}
              view={cashFlowView}
              onViewChange={setCashFlowView}
            />
          </div>

          {/* Payment Alerts card */}
          <div className="col-span-1 bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[18px] p-5 shadow-sm flex flex-col gap-4">
            <PaymentAlerts />
          </div>
        </div>

        {/* Section: Loans & Interest */}
        <div className="flex flex-col gap-3.5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h3 className="text-[#101828] dark:text-[var(--text-primary)] text-base font-bold">
                Loans & Interest
              </h3>
              <span className="bg-[#1b265c] text-white px-2 py-0.5 rounded-[4px] text-[10px] font-bold tracking-wider">
                NEW
              </span>
            </div>
            <Link href="/dashboard/client/properties" className="text-[#175cd3] dark:text-[#53b1fd] text-xs font-bold hover:underline">
              View loans
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: Overall Interest & 3 Sub-Cards */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              {/* Overall Interest Card */}
              <div className="bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[18px] p-5 shadow-sm flex flex-col justify-between gap-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[10px] bg-[#eff4ff] text-[#3538cd] flex items-center justify-center font-bold text-base">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                        <line x1="19" y1="5" x2="5" y2="19" />
                        <circle cx="6.5" cy="6.5" r="2.5" />
                        <circle cx="17.5" cy="17.5" r="2.5" />
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs font-medium">Overall Interest (FY 25–26)</span>
                      <span className="text-[#101828] dark:text-[var(--text-primary)] text-2xl font-bold">A$ 0</span>
                    </div>
                  </div>
                  <span className="bg-[#f8f9fc] dark:bg-[var(--surface-2)] border border-[#eaecf0] dark:border-[var(--border)] text-[#344054] dark:text-[var(--text-secondary)] px-2.5 py-1 rounded-[6px] text-xs font-semibold">
                    0.00% avg p.a.
                  </span>
                </div>

                {/* Progress Bar (Fixed vs Variable) */}
                <div className="flex flex-col gap-2">
                  <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-[#f2f4f7] dark:bg-[var(--surface-2)]">
                    <div className="bg-[#1b265c] h-full" style={{ width: '60%' }} />
                    <div className="bg-[#f79009] h-full" style={{ width: '40%' }} />
                  </div>
                  <div className="flex justify-between items-center text-xs text-[#344054] dark:text-[var(--text-secondary)] font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-[2px] bg-[#1b265c] inline-block" />
                      <span>Fixed 0% · A$ 0</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-[2px] bg-[#f79009] inline-block" />
                      <span>Variable 0% · A$ 0</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3 Sub-Cards Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Fixed Interest Card */}
                <div className="bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[16px] p-4 shadow-sm flex flex-col justify-between gap-3">
                  <div className="flex justify-between items-center">
                    <div className="w-8 h-8 rounded-[8px] bg-[#eff8ff] text-[#175cd3] flex items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <span className="bg-[#f8f9fc] dark:bg-[var(--surface-2)] border border-[#eaecf0] dark:border-[var(--border)] text-[#344054] dark:text-[var(--text-secondary)] px-2 py-0.5 rounded text-[11px] font-semibold">
                      0.00% p.a.
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs font-medium">Fixed Interest</span>
                    <span className="text-[#101828] dark:text-[var(--text-primary)] text-xl font-bold">A$ 0</span>
                  </div>
                  <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[11px]">
                    A$ 0 fixed
                  </span>
                </div>

                {/* Variable Interest Card */}
                <div className="bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[16px] p-4 shadow-sm flex flex-col justify-between gap-3">
                  <div className="flex justify-between items-center">
                    <div className="w-8 h-8 rounded-[8px] bg-[#fffaf5] text-[#d97706] flex items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                        <path d="M2 12h5l3 5 4-10 3 5h5" />
                      </svg>
                    </div>
                    <span className="bg-[#fff6ed] dark:bg-[var(--surface-2)] border border-[#ffecd5] dark:border-[var(--border)] text-[#b54708] dark:text-[#f79009] px-2 py-0.5 rounded text-[11px] font-semibold">
                      0.00% p.a.
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs font-medium">Variable Interest</span>
                    <span className="text-[#101828] dark:text-[var(--text-primary)] text-xl font-bold">A$ 0</span>
                  </div>
                  <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[11px]">
                    A$ 0 on variable rate
                  </span>
                </div>

                {/* Available Redraw Card */}
                <div className="bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[16px] p-4 shadow-sm flex flex-col justify-between gap-3">
                  <div className="flex justify-between items-center">
                    <div className="w-8 h-8 rounded-[8px] bg-[#eefdf4] text-[#12b76a] flex items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <path d="M7 15h0M2 10h20" />
                      </svg>
                    </div>
                    <span className="bg-[#ecfdf3] dark:bg-[var(--surface-2)] text-[#027a48] dark:text-[#5dcaa5] px-2 py-0.5 rounded-[12px] text-[11px] font-semibold">
                      Ready
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs font-medium">Available Redraw</span>
                    <span className="text-[#101828] dark:text-[var(--text-primary)] text-xl font-bold">A$ 0</span>
                  </div>
                  <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[11px]">
                    Variable loan
                  </span>
                </div>
              </div>
            </div>

            {/* Right 1 Column: Repayment Summary Card */}
            <div className="lg:col-span-1 bg-white dark:bg-[var(--surface-1)] border border-[#eaeef4] dark:border-[var(--border)] rounded-[18px] p-5 shadow-sm flex flex-col justify-between gap-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[8px] bg-[#eff8ff] text-[#175cd3] flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                  </div>
                  <h3 className="text-[#101828] dark:text-[var(--text-primary)] text-sm font-bold">Repayment Summary</h3>
                </div>
                <Link href="/dashboard/client/properties" className="text-[#175cd3] dark:text-[#53b1fd] text-xs font-bold hover:underline">
                  View schedule
                </Link>
              </div>

              {/* Month repayment / Next Due */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs font-medium">
                  <span className="text-[#667085] dark:text-[var(--text-secondary)]">{monthName} repayment</span>
                  <span className="text-[#101828] dark:text-[var(--text-primary)] font-bold">A$ 0 <span className="font-normal text-[#667085] dark:text-[var(--text-secondary)]">of A$ 0 paid</span></span>
                </div>
                <div className="h-1.5 w-full bg-[#f2f4f7] dark:bg-[var(--surface-2)] rounded-full overflow-hidden">
                  <div className="h-full bg-[#f79009] rounded-full w-0" />
                </div>
                <div className="text-[#b54708] dark:text-[#f79009] text-xs font-bold mt-1">
                  Next due -- · in -- days
                </div>
              </div>

              {/* This financial year (since 1 Jul) */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[#f2f4f7] dark:border-[var(--border)]">
                <span className="text-[#667085] dark:text-[var(--text-secondary)] text-xs font-medium">
                  This financial year (since 1 Jul)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#f8f9fc] dark:bg-[var(--surface-2)] rounded-[10px] p-2.5 flex flex-col gap-0.5 items-center justify-center text-center">
                    <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[10px] font-bold tracking-wider uppercase">PRINCIPAL</span>
                    <span className="text-[#101828] dark:text-[var(--text-primary)] text-xs font-bold">A$ 0</span>
                  </div>
                  <div className="bg-[#f8f9fc] dark:bg-[var(--surface-2)] rounded-[10px] p-2.5 flex flex-col gap-0.5 items-center justify-center text-center">
                    <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[10px] font-bold tracking-wider uppercase">INTEREST</span>
                    <span className="text-[#101828] dark:text-[var(--text-primary)] text-xs font-bold">A$ 0</span>
                  </div>
                  <div className="bg-[#f8f9fc] dark:bg-[var(--surface-2)] rounded-[10px] p-2.5 flex flex-col gap-0.5 items-center justify-center text-center">
                    <span className="text-[#667085] dark:text-[var(--text-secondary)] text-[10px] font-bold tracking-wider uppercase">TOTAL</span>
                    <span className="text-[#101828] dark:text-[var(--text-primary)] text-xs font-bold">A$ 0</span>
                  </div>
                </div>
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
                      {formatClientCurrency(item.type === 'revenue' ? item.amount : -item.amount, { showPlus: true })}
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
                            href={`/dashboard/client/entities/${item.entityId}/properties/${item.id}`}
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

                      {/* Net value in Figma is "Net +$24.2K" or dynamic */}
                      <span className="text-[#12b76a] text-[14px] font-bold">Net {formatClientCurrency(item.net, { short: true, showPlus: true, decimals: 1 })}</span>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-semibold text-[#475467] dark:text-[var(--text-secondary)] mt-1">
                      <span>Value <strong className="text-[#101828] dark:text-[var(--text-primary)]">{formatCurrencyShort(item.marketValue)}</strong></span>
                      <span>Loan <strong className="text-[#101828] dark:text-[var(--text-primary)]">{formatCurrencyShort(item.outstandingLoans)}</strong></span>
                      <span>Income <strong className="text-[#12b76a]">{formatClientCurrency(item.income, { short: true, showPlus: true })}</strong></span>
                      <span>Expenses <strong className="text-[#f04438]">{formatClientCurrency(-item.expense, { short: true })}</strong></span>
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
