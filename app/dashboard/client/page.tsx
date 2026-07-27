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
import CashFlowChart from "@/app/components/clients/CashFlowChart";
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
    description: tx.description || `${tx.type === "revenue" ? "Income" : "Expense"} - ${tx.categoryName}`,
    categoryName: tx.categoryName,
    meta: tx.propertyName || tx.propertyNames?.[0] || titleCase(tx.type),
    type: tx.type,
    amount: Math.abs(tx.netAmount || tx.grossAmount || 0),
  }));

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
        fallback={<ClientPortfolioSkeleton />}
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
              <button type="button" className="m-db-bell-btn" aria-label="Notifications">
                <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '20px', height: '20px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span className="m-db-bell-dot" />
              </button>
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
                  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '20px', height: '20px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                    <path d="M3 21h18" />
                    <path d="M3 10h18" />
                    <path d="M5 6h14" />
                    <path d="M4 10v11" />
                    <path d="M20 10v11" />
                    <path d="M8 14v3" />
                    <path d="M12 14v3" />
                    <path d="M16 14v3" />
                  </svg>
                  Create Entity
                </Link>
                <div className="m-db-actions-row">
                  <Link href="/dashboard/client/transactions/new" className="m-db-action-box tx">
                    <div className="m-db-action-icon-wrap">
                      <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '20px', height: '20px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                        <path d="m7 15 5 5 5-5" />
                        <path d="m17 9-5-5-5 5" />
                      </svg>
                    </div>
                    <span>Add Transaction</span>
                  </Link>

                  <Link
                    href={entities.length > 0 ? `/dashboard/client/entities/${entities[0].id}/properties/new` : "/dashboard/client/entities/new"}
                    className="m-db-action-box property"
                  >
                    <div className="m-db-action-icon-wrap">
                      <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '20px', height: '20px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <path d="M12 18v-6" />
                        <path d="M9 15h6" />
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
                  <h3 className="m-db-activity-title">Recent activity</h3>
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
                                <line x1="7" y1="17" x2="17" y2="7" />
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
                  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '20px', height: '20px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                    <path d="M3 21h18" />
                    <path d="M3 10h18" />
                    <path d="M5 6h14" />
                    <path d="M4 10v11" />
                    <path d="M20 10v11" />
                    <path d="M8 14v3" />
                    <path d="M12 14v3" />
                    <path d="M16 14v3" />
                  </svg>
                  Create Entity
                </Link>
                <div className="m-db-actions-row">
                  <Link href="/dashboard/client/transactions/new" className="m-db-action-box tx">
                    <div className="m-db-action-icon-wrap">
                      <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '20px', height: '20px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                        <path d="m7 15 5 5 5-5" />
                        <path d="m17 9-5-5-5 5" />
                      </svg>
                    </div>
                    <span>Add Transaction</span>
                  </Link>

                  <Link
                    href={entities.length > 0 ? `/dashboard/client/entities/${entities[0].id}/properties/new` : "/dashboard/client/entities/new"}
                    className="m-db-action-box property"
                  >
                    <div className="m-db-action-icon-wrap">
                      <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '20px', height: '20px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <path d="M12 18v-6" />
                        <path d="M9 15h6" />
                      </svg>
                    </div>
                    <span>Add Property</span>
                  </Link>
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
                          <span>Value <strong style={{ color: '#101828' }}>{formatCurrencyShort(item.marketValue)}</strong></span>
                          <span>Loan <strong style={{ color: '#101828' }}>{formatCurrencyShort(item.outstandingLoans)}</strong></span>
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
                    <div className="flex flex-col items-center justify-center p-6 text-center text-[#667085]" style={{ minHeight: '120px' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '32px', height: '32px', color: '#98a2b3' }} className="mb-2">
                        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <path d="M9 22V12h6v10" />
                      </svg>
                      <span className="text-sm font-semibold">No properties available</span>
                      <span className="text-xs text-[#98a2b3] mt-1">Add a property to start tracking.</span>
                    </div>
                  ) : (
                    propertyListItems.map((item, idx) => (
                      <div key={`${item.id}-${idx}`} style={{ display: 'flex', flexDirection: 'column', padding: '16px', borderBottom: idx < propertyListItems.length - 1 ? '1px solid #f2f4f7' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {item.isReal ? (
                              <Link
                                href={`/dashboard/client/entities/${item.entityId}/properties/${item.id}`}
                                className="m-db-entity-name"
                                style={{ textDecoration: 'none', color: '#101828', fontSize: '15px', fontWeight: 700 }}
                              >
                                {item.name}
                              </Link>
                            ) : (
                              <span style={{ color: '#101828', fontSize: '15px', fontWeight: 700 }}>{item.name}</span>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '12px', color: '#667085' }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '12px', height: '12px', flexShrink: 0 }}>
                                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                              </svg>
                              <Link
                                href={`/dashboard/client/entities/${item.entityId}`}
                                style={{ textDecoration: 'none', color: '#667085' }}
                              >
                                {item.entityName}
                              </Link>
                            </div>
                          </div>

                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '16px', height: '16px', color: '#98a2b3' }}>
                            <path d="m9 18 6-6-6-6" />
                          </svg>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '12px', fontWeight: 600, color: '#475467' }}>
                          <span>Value <strong style={{ color: '#101828' }}>{formatCurrencyShort(item.marketValue)}</strong></span>
                          <span>Loan <strong style={{ color: '#101828' }}>{formatCurrencyShort(item.outstandingLoans)}</strong></span>
                        </div>

                        <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '12px', fontWeight: 600 }}>
                          <span style={{ color: '#475467' }}>Income <strong style={{ color: '#12b76a' }}>{formatClientCurrency(item.income, { short: true, showPlus: true })}</strong></span>
                          <span style={{ color: '#475467' }}>Expense <strong style={{ color: '#344054' }}>{formatClientCurrency(-item.expense, { short: true })}</strong></span>
                          <span style={{ color: '#475467' }}>Net <strong style={{ color: item.net >= 0 ? '#12b76a' : '#f04438' }}>{formatClientCurrency(item.net, { short: true, showPlus: true })}</strong></span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="m-db-stat-card" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', borderRadius: '16px', background: 'var(--surface-1)', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(16, 24, 40, 0.01)' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Loan vs Value</h3>

                <div style={{ display: 'flex', height: '8px', width: '100%', borderRadius: '4px', overflow: 'hidden', background: 'var(--border)', margin: '4px 0' }}>
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
      fallback={<ClientPortfolioSkeleton />}
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
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
              <path d="m7 15 5 5 5-5" />
              <path d="m17 9-5-5-5 5" />
            </svg>
            Add transaction
          </Link>

          <Link
            href={entities.length > 0 ? `/dashboard/client/entities/${entities[0].id}/properties/new` : "/dashboard/client/entities/new"}
            className="flex items-center justify-center gap-2.5 py-4 px-6 rounded-xl font-semibold transition-all duration-200 hover:scale-[1.01]"
            style={{
              background: 'linear-gradient(135deg, #ffd36f 0%, #f7a61a 100%)',
              color: '#1b265c',
              boxShadow: '0 4px 15px rgba(247, 166, 26, 0.15)',
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <path d="M12 18v-6" />
              <path d="M9 15h6" />
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
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
              <path d="M3 21h18" />
              <path d="M3 10h18" />
              <path d="M5 6h14" />
              <path d="M4 10v11" />
              <path d="M20 10v11" />
              <path d="M8 14v3" />
              <path d="M12 14v3" />
              <path d="M16 14v3" />
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
          <div className="bg-white border border-[#eaeef4] rounded-[18px] p-5 flex flex-col gap-3.5 shadow-sm">
            <div className="flex justify-between items-center">
              <div className="w-9 h-9 rounded-[10px] bg-[#eefdf4] text-[#12b76a] flex items-center justify-center">
                <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <span className="bg-[#ecfdf3] text-[#027a48] px-2 py-0.5 rounded-[20px] text-xs font-semibold">+12%</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[#667085] text-xs font-medium">Cash Flow (this month)</span>
              <span className="text-[#101828] text-xl font-bold">{formatCurrencyShort(displayCashFlow)}</span>
            </div>
          </div>

          <div className="bg-white border border-[#eaeef4] rounded-[18px] p-5 flex flex-col gap-3.5 shadow-sm">
            <div className="flex justify-between items-center">
              <div className="w-9 h-9 rounded-[10px] bg-[#eff8ff] text-[#175cd3] flex items-center justify-center">
                <span className="text-base font-bold">$</span>
              </div>
              <span className="bg-[#ecfdf3] text-[#027a48] px-2 py-0.5 rounded-[20px] text-xs font-semibold">+8.4%</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[#667085] text-xs font-medium">Income (this month)</span>
              <span className="text-[#101828] text-xl font-bold">{formatCurrencyShort(displayIncomeThisMonth)}</span>
            </div>
          </div>

          <div className="bg-white border border-[#eaeef4] rounded-[18px] p-5 flex flex-col gap-3.5 shadow-sm">
            <div className="flex justify-between items-center">
              <div className="w-9 h-9 rounded-[10px] bg-[#fff5f2] text-[#f04438] flex items-center justify-center">
                <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
              </div>
              <span className="bg-[#fef3f2] text-[#b42318] px-2 py-0.5 rounded-[20px] text-xs font-semibold">-3.5%</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[#667085] text-xs font-medium">Expenses (this month)</span>
              <span className="text-[#101828] text-xl font-bold">{formatCurrencyShort(displayExpenseThisMonth)}</span>
            </div>
          </div>
        </div>

        {/* Dashboard Grid Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Chart card */}
          <div className="md:col-span-2 xl:col-span-2 order-1 xl:order-1 bg-white border border-[#eaeef4] rounded-[18px] p-6 shadow-sm flex flex-col gap-4">
            <CashFlowChart
              months={displayMonths}
              income={displayIncome}
              expenses={displayExpense}
              view={cashFlowView}
              onViewChange={setCashFlowView}
            />
          </div>

          {/* Recent Activity card */}
          <div className="col-span-1 order-3 xl:order-2 bg-white border border-[#eaeef4] rounded-[18px] p-5 shadow-sm flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-[#101828] text-base font-bold">Recent Activity</h3>
            </div>

            <div className="flex flex-col divide-y divide-[#f2f4f7]">
              {activityItems.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-center text-[#667085]">
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
                        <strong className="text-[#101828] text-[13px] font-bold truncate">{item.description}</strong>
                        <span className="text-[#667085] text-[11px] truncate">
                          {item.categoryName} · {item.meta}
                        </span>
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

          {/* By Entity Section */}
          <div className="col-span-1 order-2 xl:order-3 bg-white border border-[#eaeef4] rounded-[18px] p-5 shadow-sm flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-[#101828] text-base font-bold">By entity</h3>
              {entities.length > 0 && (
                <Link href="/dashboard/client/entities" className="text-[#175cd3] text-xs font-bold hover:underline">
                  View all
                </Link>
              )}
            </div>

            <div className="flex flex-col divide-y divide-[#f2f4f7]">
              {entityListItems.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-center text-[#667085]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '32px', height: '32px' }} className="mb-2 text-[#98a2b3]">
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
                  <div key={item.id}>
                    {item.propertiesCount === 0 ? (
                      <div className="py-4 flex justify-between items-center">
                        <span className="text-[#101828] text-[14px] font-bold">{item.name}</span>
                        <span className="text-[#8c9ba5] text-xs font-semibold">No properties yet</span>
                      </div>
                    ) : (
                      <div className="py-4 flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <Link
                            href={`/dashboard/client/entities/${item.id}`}
                            className="text-[#101828] text-[14px] font-bold hover:underline"
                          >
                            {item.name}
                          </Link>
                          <span className="text-[#12b76a] text-[14px] font-bold">{formatCurrencyShort(item.netPosition)}</span>
                        </div>

                        <p className="text-[#667085] text-xs m-0">
                          {item.propertiesCount} propert{item.propertiesCount === 1 ? 'y' : 'ies'}
                        </p>

                        <div className="h-2 w-full bg-[var(--accent)] rounded-full overflow-hidden my-1 relative">
                          <div
                            className="h-full bg-[var(--brand)] transition-all duration-300"
                            style={{ width: `${Math.min(item.loanPercentage, 100)}%` }}
                          />
                        </div>

                        <div className="flex justify-between text-[#475467] text-xs font-medium">
                          <span>Loan <strong className="text-[#101828]">{formatCurrencyShort(item.outstandingLoans)}</strong></span>
                          <span>Equity <strong className="text-[#101828]">{formatCurrencyShort(item.netPosition)}</strong></span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* By Property Section */}
          <div className="md:col-span-2 xl:col-span-2 order-4 xl:order-4 bg-white border border-[#eaeef4] rounded-[18px] p-5 shadow-sm flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-[#101828] text-base font-bold">By property</h3>
              {properties.length > 0 && (
                <Link href="/dashboard/client/properties" className="text-[#175cd3] text-xs font-bold hover:underline">
                  View all
                </Link>
              )}
            </div>

            <div className="flex flex-col divide-y divide-[#f2f4f7]">
              {propertyListItems.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-center text-[#667085]">
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
                            className="text-[#101828] text-[14px] font-bold hover:underline truncate"
                          >
                            {item.name}
                          </Link>
                        ) : (
                          <span className="text-[#101828] text-[14px] font-bold truncate">{item.name}</span>
                        )}

                        <div className="flex items-center gap-1.5 mt-1 text-[#667085] text-[11px]">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '12px', height: '12px', flexShrink: 0 }}>
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                          </svg>
                          <Link
                            href={`/dashboard/client/entities/${item.entityId}`}
                            className="text-[#667085] hover:underline"
                          >
                            {item.entityName}
                          </Link>
                        </div>
                      </div>

                      {/* Net value in Figma is "Net +$24.2K" or dynamic */}
                      <span className="text-[#12b76a] text-[14px] font-bold">Net {formatClientCurrency(item.net, { short: true, showPlus: true, decimals: 1 })}</span>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-semibold text-[#475467] mt-1">
                      <span>Value <strong className="text-[#101828]">{formatCurrencyShort(item.marketValue)}</strong></span>
                      <span>Loan <strong className="text-[#101828]">{formatCurrencyShort(item.outstandingLoans)}</strong></span>
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
