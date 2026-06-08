"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useId, useRef } from "react";
import { Skeleton } from "boneyard-js/react";
import { ClientEntitiesSkeleton } from "@/app/components/PortalSkeletons";
import { logout } from "@/src/lib/logout";
import { getSession } from "@/src/lib/session";
import type { CoreEntity } from "@/src/lib/coreApi";
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

        // 3. Fetch properties for each entity in parallel
        const propertyPromises = loadedEntities.map(async (entity) => {
          try {
            const propRes = await fetch(`/api/entities/${entity.id}/properties`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (propRes.ok) {
              const data = await propRes.json();
              return (data.items || []).map((p: any) => ({ ...p, entityId: entity.id }));
            }
          } catch (err) {
            console.error(`Failed to fetch properties for entity ${entity.id}:`, err);
          }
          return [];
        });

        const propertiesArrays = await Promise.all(propertyPromises);
        const allProperties = propertiesArrays.flat();
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

  const displayRepayments = properties.length === 0 ? 5420 : (transactions.length === 0 ? 5420 : repaymentsThisMonth);

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

  // Merge mock data if there are no properties or transactions
  const isDemo = properties.length === 0;
  const displayMarketValue = isDemo ? 3250000 : marketValue;
  const displayOutstandingLoans = isDemo ? 1380000 : outstandingLoans;
  const displayNetPosition = isDemo ? 1870000 : netPosition;
  const displayCashFlow = isDemo ? 8420 : (transactions.length === 0 ? 8420 : cashFlowThisMonth);
  const displayLoansValue = displayOutstandingLoans;

  const hasTxData = transactions.length > 0;
  const displayMonths = hasTxData ? months : ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];
  const displayIncome = hasTxData ? incomeHistory : [12000, 7000, 10000, 15000, 6000, 11000];
  const displayExpense = hasTxData ? expenseHistory : [3000, 7000, 4000, 800, 7500, 4500];

  const maxMonthSum = Math.max(...displayIncome.map((inc, idx) => inc + displayExpense[idx]), 1);

  const demoActivity = [
    {
      id: "demo-1",
      description: "Rent - 24 Darling St",
      categoryName: "Rental Income",
      meta: "XX3421",
      type: "revenue",
      amount: 4200,
    },
    {
      id: "demo-2",
      description: "Water Bill",
      categoryName: "Utilities",
      meta: "Water 24 Darling Street",
      type: "expense",
      amount: 312,
    },
    {
      id: "demo-3",
      description: "Loan Interest",
      categoryName: "Loan Interest",
      meta: "Monthly",
      type: "expense",
      amount: 2180,
    },
    {
      id: "demo-4",
      description: "Rent - 12 Church Avenue",
      categoryName: "Rental Income",
      meta: "XX3421",
      type: "revenue",
      amount: 3800,
    },
    {
      id: "demo-5",
      description: "Cleaning Bill",
      categoryName: "Utilities",
      meta: "12 Church Avenue",
      type: "expense",
      amount: 670,
    },
  ];

  const activityItems = transactions.length > 0
    ? transactions.slice(0, 5).map(tx => ({
        id: tx.id,
        description: tx.description || `${tx.type === "revenue" ? "Income" : "Expense"} - ${tx.categoryName}`,
        categoryName: tx.categoryName,
        meta: tx.propertyName || tx.propertyNames?.[0] || titleCase(tx.type),
        type: tx.type,
        amount: Math.abs(tx.netAmount || tx.grossAmount || 0),
      }))
    : demoActivity;

  const isDemoDetailed = properties.length === 0;
  const entityListItems = isDemoDetailed
    ? [
        {
          id: "demo-entity-1",
          name: "Johnson Family Trust",
          propertiesCount: 2,
          marketValue: 2400000,
          outstandingLoans: 1050000,
          netPosition: 1350000,
          loanPercentage: (1050000 / 2400000) * 100,
          isReal: false,
        },
        {
          id: "demo-entity-2",
          name: "SJ Holdings Pvt Ltd.",
          propertiesCount: 1,
          marketValue: 850000,
          outstandingLoans: 330000,
          netPosition: 520000,
          loanPercentage: (330000 / 850000) * 100,
          isReal: false,
        }
      ]
    : entities.map(entity => {
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

  const propertyListItems = isDemoDetailed
    ? [
        {
          id: "demo-prop-1",
          name: "24 Darling Street",
          entityName: "Johnson Family Trust",
          marketValue: 1200000,
          outstandingLoans: 680000,
          income: 54600,
          expense: 30400,
          net: 24200,
          status: "Rented",
          imageUrl: "/house_darling_st.png",
          isReal: false,
          entityId: "demo-entity-1",
        },
        {
          id: "demo-prop-2",
          name: "12 Church Ave",
          entityName: "Johnson Family Trust",
          marketValue: 1050000,
          outstandingLoans: 420000,
          income: 45600,
          expense: 24000,
          net: 24200,
          status: "Self Occupied",
          imageUrl: "/house_church_ave.png",
          isReal: false,
          entityId: "demo-entity-1",
        },
        {
          id: "demo-prop-3",
          name: "8 Harbour Road",
          entityName: "SJ Holdings Pvt Ltd.",
          marketValue: 1000000,
          outstandingLoans: 280000,
          income: 39000,
          expense: 18400,
          net: 24200,
          status: "Available for Rent",
          imageUrl: "/house_harbour_rd.png",
          isReal: false,
          entityId: "demo-entity-2",
        }
      ]
    : properties.map((prop, idx) => {
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

  // Use Figma spec returns in demo mode, calculate dynamically in live mode
  const portfolioAvgReturn = properties.length === 0
    ? (selectedEntityFilter === 'all' ? 4.7 : selectedEntityFilter === 'Johnson Family Trust' ? 4.6 : 4.8)
    : (calculatedReturnRate > 0 ? calculatedReturnRate : 4.7);

  // Entities list for properties filter row
  const propertiesEntityPills = properties.length === 0
    ? [
        { id: 'all', name: 'All Entities' },
        { id: 'Johnson Family Trust', name: 'Johnson Family Trust' },
        { id: 'SJ Holdings Pvt Ltd.', name: 'SJ Holdings Pvt Ltd.' },
        { id: 'Sarah Johnson', name: 'Sarah Johnson' }
      ]
    : [
        { id: 'all', name: 'All Entities' },
        ...entities.map(e => ({ id: e.id, name: e.name }))
      ];

  const loanPercentageOverall = displayMarketValue > 0 ? (displayOutstandingLoans / displayMarketValue) * 100 : 0;
  const equityPercentageOverall = 100 - loanPercentageOverall;

  function formatCurrencyShort(value: number) {
    const sign = value < 0 ? "-" : "";
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
      return `${sign}$${(absValue / 1000000).toFixed(2)}M`;
    }
    if (absValue >= 10000) {
      const kVal = absValue / 1000;
      if (kVal % 1 === 0) {
        return `${sign}$${kVal.toFixed(0)}K`;
      }
      return `${sign}$${kVal.toFixed(1)}K`;
    }
    return `${sign}$${absValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }

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
        name="client-entities-page"
        loading={isLoading}
        fallback={<ClientEntitiesSkeleton />}
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
                  {activityItems.map((item) => (
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
                        {item.type === 'revenue' ? '+' : '-'}${item.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  ))}
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
                  <button 
                    type="button" 
                    className="m-db-activity-view-all"
                    onClick={() => router.push('/dashboard/client/entities')}
                    style={{ background: 'none', border: 'none', padding: 0 }}
                  >
                    View all
                  </button>
                </div>
                
                <div className="m-db-activity-list-card">
                  {entityListItems.map((item) => (
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
                  ))}
                </div>
              </div>

              {/* By Property Section */}
              <div className="m-db-activity-section" style={{ marginTop: '16px' }}>
                <div className="m-db-activity-header">
                  <h3 className="m-db-activity-title">By Property</h3>
                  <button 
                    type="button" 
                    className="m-db-activity-view-all"
                    onClick={() => router.push('/dashboard/client/property')}
                    style={{ background: 'none', border: 'none', padding: 0 }}
                  >
                    View all
                  </button>
                </div>
                
                <div className="m-db-activity-list-card">
                  {propertyListItems.map((item, idx) => (
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
                        <span style={{ color: '#475467' }}>Income <strong style={{ color: '#12b76a' }}>+{formatCurrencyShort(item.income)}</strong></span>
                        <span style={{ color: '#475467' }}>Expense <strong style={{ color: '#344054' }}>-{formatCurrencyShort(item.expense).replace('$', '')}</strong></span>
                        <span style={{ color: '#475467' }}>Net <strong style={{ color: item.net >= 0 ? '#12b76a' : '#f04438' }}>{item.net >= 0 ? '+' : ''}{formatCurrencyShort(item.net)}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Loan vs Value Section */}
              <div className="m-db-stat-card" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', borderRadius: '16px', background: '#ffffff', border: '1px solid #eaeef4', boxShadow: '0 4px 12px rgba(16, 24, 40, 0.01)' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#101828', margin: 0 }}>Loan vs Value</h3>
                
                <div style={{ display: 'flex', height: '8px', width: '100%', borderRadius: '4px', overflow: 'hidden', background: '#eaeef4', margin: '4px 0' }}>
                  <div style={{ width: `${loanPercentageOverall}%`, background: '#1b265c', transition: 'width 0.3s ease' }} />
                  <div style={{ width: `${equityPercentageOverall}%`, background: '#f7a61a', transition: 'width 0.3s ease' }} />
                </div>
                
                <div style={{ display: 'flex', gap: '16px', fontSize: '13px', fontWeight: 600, color: '#475467' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#1b265c' }} />
                    <span>Loan</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#f7a61a' }} />
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
      name="client-entities-page"
      loading={isLoading}
      fallback={<ClientEntitiesSkeleton />}
    >
      <section className="portal-page">
        <div className="portal-page-header">
          <div>
            <p className="portal-kicker">Client Workspace</p>
            <h1>Your Entities</h1>
            <p>Register the legal structures that hold your properties.</p>
          </div>

          <div className="portal-page-actions">
            <Link
              href="/dashboard/client/entities/new"
              className="entity-wizard-primary"
            >
              + Add Entity
            </Link>
            <Link
              href="/dashboard/client/transactions/new"
              className="portal-secondary-link"
            >
              + Add Transaction
            </Link>
            <button
              type="button"
              className="portal-secondary-link"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>

        {errorMessage ? (
          <p className="entity-wizard-error">{errorMessage}</p>
        ) : entities.length === 0 ? (
          <div className="client-detail-empty">
            <p>
              You haven&apos;t added any entities yet. Use <strong>Add Entity</strong>{" "}
              to register your first Individual, Trust, Company or SMSF — then you
              can map properties and transactions to it.
            </p>
          </div>
        ) : (
          <div className="client-entities-container">
            {/* Sorting & Pagination Controls */}
            <div className="client-list-toolbar" style={{ justifyContent: 'flex-start', gap: '24px' }}>
              <StaticSelect
                label="Sort by"
                horizontal
                value={sortBy}
                options={[
                  { label: "Alphabetical (A - Z)", value: "name-asc" },
                  { label: "Alphabetical (Z - A)", value: "name-desc" },
                  { label: "Date Joined (Newest first)", value: "date-desc" },
                  { label: "Date Joined (Oldest first)", value: "date-asc" },
                ]}
                onChange={(value) => setSortBy(value)}
              />

              {entities.length > 20 && (
                <StaticSelect
                  label="Show"
                  horizontal
                  value={pageSize}
                  options={[
                    { label: "20 records", value: "20" },
                    { label: "50 records", value: "50" },
                    { label: "100 records", value: "100" },
                    { label: "200 records", value: "200" },
                    { label: "Load All", value: "all" },
                  ]}
                  onChange={(value) => setPageSize(value)}
                />
              )}
            </div>

            <ul className="client-detail-entity-list">
              {displayedEntities.map((entity) => (
                <li key={entity.id} className="client-detail-entity-row">
                  <div>
                    <Link
                      href={`/dashboard/client/entities/${entity.id}`}
                      className="client-detail-entity-link"
                    >
                      <strong>{entity.name}</strong>
                    </Link>
                    <span>{titleCase(entity.entityType)}</span>
                  </div>
                  <div className="client-detail-entity-meta">
                    {entity.createdAt && (
                      <span style={{ marginRight: '8px' }}>
                        Joined {formatDate(entity.createdAt)}
                      </span>
                    )}
                    <span>
                      {entity.beneficiaries.length} beneficiar
                      {entity.beneficiaries.length === 1 ? "y" : "ies"}
                    </span>
                    <Link
                      href={`/dashboard/client/entities/${entity.id}/edit`}
                      className="entity-icon-action"
                      aria-label={`Edit ${entity.name}`}
                      title="Edit entity"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            {entities.length > limit && (
              <div className="client-list-load-more-container">
                <button
                  type="button"
                  className="client-list-load-more-btn"
                  onClick={() => {
                    if (pageSize === "20") setPageSize("50");
                    else if (pageSize === "50") setPageSize("100");
                    else if (pageSize === "100") setPageSize("200");
                    else setPageSize("all");
                  }}
                >
                  Load More Entities
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </Skeleton>
  );
}
