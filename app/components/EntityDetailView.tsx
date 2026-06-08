"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState, useRef } from "react";
import { Skeleton } from "boneyard-js/react";
import {
  EntityDetailSkeleton,
  EntityPropertyListSkeleton,
  TrendSkeleton,
} from "@/app/components/PortalSkeletons";
import { AllTransactionsView } from "@/app/components/TransactionsFeature";
import DocumentsListView from "@/app/components/DocumentsListView";
import { getSession } from "@/src/lib/session";
import type {
  CoreEntity,
  CoreProperty,
  CoreTransactionListItem,
  ReconciliationSession,
} from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

export type EntityDetailViewProps = {
  entityId: string;
  backHref: string;
  backLabel: string;
  addPropertyHref: string;
  addTransactionHref?: string;
  transactionRulesHref?: string;
  transactionRulesLabel?: string;
  transactionRulesClassName?: string;
  transactionRulesIcon?: "rules" | "reconcile";
  editEntityHref: string;
  propertyDetailHrefBase: string;
  reconciliationHref?: string;
};

type EntityTab = "properties" | "transactions" | "documents" | "reconciliation";

const entityTabs: { id: EntityTab; label: string }[] = [
  { id: "properties", label: "Properties" },
  { id: "transactions", label: "Transactions" },
  { id: "documents", label: "Documents" },
  { id: "reconciliation", label: "Reconciliations" },
];

function titleCase(value: string) {
  if (!value) return "";
  return value
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function entityTypeLabel(value: string) {
  if (value === "smsf") return "Self Managed Super Fund (SMSF)";
  if (value === "trust") return "Trust (Discretionary/Unit)";
  if (value === "company") return "Company (Pvt Ltd)";
  return titleCase(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function appendQueryParam(href: string, key: string, value: string) {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}${key}=${encodeURIComponent(value)}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function monthKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  if (Number.isNaN(date.getTime())) return key;
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
}

// Removed static AVAILABLE_MANAGERS. Now loaded dynamically from API.


export default function EntityDetailView({
  entityId,
  backHref,
  backLabel,
  addPropertyHref,
  addTransactionHref = "/dashboard/accountant/transactions/new",
  transactionRulesHref,
  transactionRulesLabel,
  transactionRulesClassName,
  transactionRulesIcon,
  editEntityHref,
  propertyDetailHrefBase,
  reconciliationHref,
}: EntityDetailViewProps) {
  const router = useRouter();
  const [entity, setEntity] = useState<CoreEntity | null>(null);
  const [properties, setProperties] = useState<CoreProperty[]>([]);
  const [transactions, setTransactions] = useState<CoreTransactionListItem[]>(
    [],
  );
  const [currentTab, setCurrentTab] = useState<EntityTab>("properties");
  const [isEntityLoading, setIsEntityLoading] = useState(true);
  const [isPropertiesLoading, setIsPropertiesLoading] = useState(true);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [sessionList, setSessionList] = useState<ReconciliationSession[]>([]);
  const [sessionListLoading, setSessionListLoading] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [newSessionLabel, setNewSessionLabel] = useState("");
  const [newSessionFrom, setNewSessionFrom] = useState("");
  const [newSessionTo, setNewSessionTo] = useState("");
  const [newSessionSaving, setNewSessionSaving] = useState(false);
  const [newSessionError, setNewSessionError] = useState<string | null>(null);
  const [trendView, setTrendView] = useState<"graph" | "table">("graph");
  const [selectedRmId, setSelectedRmId] = useState<string>("");
  const [availableManagers, setAvailableManagers] = useState<any[]>([]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [mobileView, setMobileView] = useState<"dashboard" | "transactions" | "documents">("dashboard");
  const [mobileDocs, setMobileDocs] = useState<any[]>([]);
  const [isMobileDocsLoading, setIsMobileDocsLoading] = useState(true);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);
  const [isMobileUploading, setIsMobileUploading] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!sessionToken || !entityId) return;
    setIsMobileDocsLoading(true);
    fetch(`/api/documents/list?entity_id=${encodeURIComponent(entityId)}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((res) => res.ok ? res.json() : { items: [] })
      .then((data) => {
        setMobileDocs(data.items || []);
      })
      .catch(() => setMobileDocs([]))
      .finally(() => setIsMobileDocsLoading(false));
  }, [sessionToken, entityId]);

  const handleMobileUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";
    setIsMobileUploading(true);

    for (const file of files) {
      try {
        const presignParams = new URLSearchParams({
          filename: file.name,
          document_type: "direct",
        });
        if (entityId) presignParams.set("entity_id", entityId);

        const presignRes = await fetch(`/api/documents/presign?${presignParams.toString()}`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });

        if (!presignRes.ok) throw new Error("Presign failed");
        const { upload_url } = await presignRes.json();

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", upload_url);
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
          xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject();
          xhr.onerror = () => reject();
          xhr.send(file);
        });

        // Refetch documents
        const res = await fetch(`/api/documents/list?entity_id=${encodeURIComponent(entityId)}`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setMobileDocs(data.items || []);
        }
      } catch (err) {
        console.error("Direct upload failed:", err);
        alert(`Failed to upload ${file.name}. Please try again.`);
      }
    }
    setIsMobileUploading(false);
  };

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;

    fetch("/api/users/me/regional-managers", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((res) => (res.ok ? res.json() : { regionalManagers: [] }))
      .then((data) => {
        if (!cancelled) {
          setAvailableManagers(data.regionalManagers || []);
        }
      })
      .catch((err) => {
        console.error("Failed to load regional managers:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  const selectedRm = useMemo(() => {
    const found = availableManagers.find(rm => rm.id === selectedRmId);
    if (found) return found;
    if (entity && (entity as any).regionalManager && (entity as any).regionalManager.id === selectedRmId) {
      return (entity as any).regionalManager;
    }
    return null;
  }, [availableManagers, selectedRmId, entity]);

  const avatarInitials = useMemo(() => {
    if (!selectedRm) return "";
    return selectedRm.name
      .split(" ")
      .map((part: string) => part.charAt(0))
      .join("")
      .toUpperCase();
  }, [selectedRm]);

  async function handleAssignRm(rmId: string) {
    if (!sessionToken || !entityId) return;

    try {
      setSelectedRmId(rmId);
      const res = await fetch(`/api/entities/${encodeURIComponent(entityId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          assignedRegionalManagerId: rmId || null,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to assign regional manager");
      }

      const updatedEntity = await res.json();
      setEntity(updatedEntity);
    } catch (err) {
      console.error("Error assigning regional manager:", err);
      alert("Failed to assign Regional Manager. Please try again.");
    }
  }


  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "properties" || tab === "transactions" || tab === "documents" || tab === "reconciliation") {
      setCurrentTab(tab);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) {
        router.replace("/login/user");
        return;
      }
      const token = session.getIdToken().getJwtToken();
      if (!cancelled) setSessionToken(token);

      const headers = { Authorization: `Bearer ${token}` };

      // Entity — must load before header renders
      fetch(`/api/entities/${encodeURIComponent(entityId)}`, { headers })
        .then((res) => {
          if (!res.ok) throw new Error("entity_not_found");
          return res.json();
        })
        .then((data: CoreEntity) => {
          if (!cancelled) {
            setEntity(data);
            setSelectedRmId((data as any).regionalManager?.id || "");
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            const msg = err instanceof Error && err.message === "entity_not_found"
              ? "Failed to load entity."
              : "Unexpected error loading entity.";
            setErrorMessage(msg);
          }
        })
        .finally(() => { if (!cancelled) setIsEntityLoading(false); });

      // Properties — independent; populates the Properties tab
      fetch(`/api/entities/${encodeURIComponent(entityId)}/properties`, { headers })
        .then((res) => (res.ok ? res.json() : { items: [] }))
        .then((data: { items?: CoreProperty[] }) => {
          if (!cancelled) setProperties(data.items || []);
        })
        .catch(() => { if (!cancelled) setProperties([]); })
        .finally(() => { if (!cancelled) setIsPropertiesLoading(false); });

      // Transactions — independent; used by trend chart and Transactions tab
      fetch(`/api/entities/${encodeURIComponent(entityId)}/transactions`, { headers })
        .then((res) => (res.ok ? res.json() : { items: [] }))
        .then((data: { items?: CoreTransactionListItem[] }) => {
          if (!cancelled) setTransactions(data.items || []);
        })
        .catch(() => { if (!cancelled) setTransactions([]); })
        .finally(() => { if (!cancelled) setIsTransactionsLoading(false); });
    }

    if (entityId) load().catch((error) => {
      console.error("Failed to load entity detail:", error);
    });
    return () => {
      cancelled = true;
    };
  }, [entityId, router]);

  useEffect(() => {
    if (currentTab !== "reconciliation" || !sessionToken || !entityId) return;
    let cancelled = false;
    setSessionListLoading(true);
    fetch(`/api/entities/${encodeURIComponent(entityId)}/reconciliation-sessions`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ReconciliationSession[]) => {
        if (!cancelled) setSessionList(Array.isArray(data) ? data : []);
      })
      .catch(() => { if (!cancelled) setSessionList([]); })
      .finally(() => { if (!cancelled) setSessionListLoading(false); });
    return () => { cancelled = true; };
  }, [currentTab, sessionToken, entityId]);

  async function handleCreateSession(e: FormEvent) {
    e.preventDefault();
    if (!sessionToken || !entityId) return;
    const label = newSessionLabel.trim();
    if (!label) {
      setNewSessionError("Label is required");
      return;
    }
    setNewSessionSaving(true);
    setNewSessionError(null);
    try {
      const res = await fetch(
        `/api/entities/${encodeURIComponent(entityId)}/reconciliation-sessions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            label,
            periodFrom: newSessionFrom || null,
            periodTo: newSessionTo || null,
          }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Failed to create session (${res.status})`);
      }
      const created = (await res.json()) as ReconciliationSession;
      setSessionList((cur) => [created, ...cur]);
      setNewSessionOpen(false);
      setNewSessionLabel("");
      setNewSessionFrom("");
      setNewSessionTo("");
      if (reconciliationHref) {
        router.push(`${reconciliationHref}/${encodeURIComponent(created.id)}`);
      }
    } catch (err) {
      setNewSessionError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setNewSessionSaving(false);
    }
  }

  const ownerCopy = useMemo(() => {
    if (!entity) return "";
    if (entity.beneficiaries.length === 1) return "1 shareholder";
    return `${entity.beneficiaries.length} shareholders`;
  }, [entity]);

  const trendRows = useMemo(() => {
    const byMonth = new Map<string, { month: string; expenses: number; income: number }>();
    for (const row of transactions) {
      const key = monthKey(row.invoiceDate);
      if (!key) continue;
      const current = byMonth.get(key) || {
        month: key,
        expenses: 0,
        income: 0,
      };
      const amount = Math.abs(row.grossAmount || 0);
      if (row.type === "revenue") current.income += amount;
      else current.expenses += amount;
      byMonth.set(key, current);
    }
    return Array.from(byMonth.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-7);
  }, [transactions]);
  const maxTrendAmount = Math.max(
    1,
    ...trendRows.flatMap((row) => [row.expenses, row.income]),
  );
  const trendTotals = useMemo(() => {
    return trendRows.reduce(
      (acc, row) => {
        acc.income += row.income;
        acc.expenses += row.expenses;
        return acc;
      },
      { income: 0, expenses: 0 },
    );
  }, [trendRows]);
  const trendNetTotal = trendTotals.income - trendTotals.expenses;

  const displayMarketValue = useMemo(() => {
    return properties.reduce((sum, p) => sum + (p.estimatedMarketValue || 0), 0);
  }, [properties]);

  const displayOutstandingLoans = useMemo(() => {
    return properties.reduce((sum, p) => {
      if (!p.loanDetails) return sum;
      const loanAmt = p.loanDetails.loan_amount ?? p.loanDetails.loanAmount ?? p.loanDetails.amount ?? 0;
      return sum + Number(loanAmt);
    }, 0);
  }, [properties]);

  const displayNetEquity = useMemo(() => {
    return displayMarketValue - displayOutstandingLoans;
  }, [displayMarketValue, displayOutstandingLoans]);

  const displayCashFlow = useMemo(() => {
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

    return incomeThisMonth - expenseThisMonth;
  }, [transactions]);

  function formatCurrencyStat(val: number) {
    const absVal = Math.abs(val);
    const sign = val < 0 ? "-" : "";
    if (absVal >= 1000000) {
      return `${sign}$${(absVal / 1000000).toFixed(2)}M`;
    }
    if (absVal >= 1000) {
      return `${sign}$${(absVal / 1000).toFixed(0)}K`;
    }
    return `${sign}$${absVal.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }

  function formatCashFlowValue(val: number) {
    const sign = val >= 0 ? "+" : "-";
    const absVal = Math.abs(val);
    return `${sign}$${absVal.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }

  const mobileTrendRows = useMemo(() => {
    if (trendRows.length > 0) {
      return trendRows.slice(-6);
    }
    return [];
  }, [trendRows]);

  const displayBeneficiaries = useMemo(() => {
    if (entity?.beneficiaries && entity.beneficiaries.length > 0) {
      return entity.beneficiaries;
    }
    return [];
  }, [entity?.beneficiaries]);

  const totalOwnership = useMemo(() => {
    return displayBeneficiaries.reduce((sum, b) => sum + (b.ownershipPercentage || 0), 0);
  }, [displayBeneficiaries]);

  const displayProperties = useMemo(() => {
    if (properties.length > 0) {
      return properties.map(p => {
        const propTxs = transactions.filter(t => t.propertyIds?.includes(p.id));
        const income = propTxs.filter(t => t.type === "revenue").reduce((sum, t) => sum + (t.netAmount || t.grossAmount || 0), 0);
        const expense = propTxs.filter(t => t.type === "expense").reduce((sum, t) => sum + (t.netAmount || t.grossAmount || 0), 0);
        const net = income - expense;

        const formatShortVal = (val: number, showSign = false) => {
          const absVal = Math.abs(val);
          const sign = val >= 0 ? (showSign ? "+" : "") : "-";
          if (absVal >= 1000) return `${sign}$${(absVal / 1000).toFixed(1)}K`;
          return `${sign}$${absVal}`;
        };

        return {
          id: p.id,
          name: p.name,
          imageUrl: p.imageUrl || null,
          entityName: entity?.name || "Individual",
          incomeText: formatShortVal(income, true),
          expenseText: formatShortVal(expense, false),
          netText: formatShortVal(net, true),
          status: p.status || "Rented",
          netVal: net
        };
      });
    }

    return [];
  }, [properties, transactions, entity?.name]);

  const displayRecentTransactions = useMemo(() => {
    if (transactions.length > 0) {
      return transactions.slice(0, 3).map(t => {
        const isRevenue = t.type === "revenue";
        const amtStr = `${isRevenue ? "+" : "-"}$${Math.abs(t.netAmount || t.grossAmount || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
        const metadataStr = t.metadata?.reference || t.metadata?.accountNumber || "XX3421";
        return {
          id: t.id,
          description: t.description || `${isRevenue ? "Rent" : "Expense"} - ${t.categoryName}`,
          categoryMeta: `${t.categoryName} - ${metadataStr}`,
          amountText: amtStr,
          isRevenue
        };
      });
    }
    return [];
  }, [transactions]);

  if (isEntityLoading) {
    return (
      <Skeleton
        name="entity-detail-page"
        loading
        fallback={<EntityDetailSkeleton />}
      >
        <EntityDetailSkeleton />
      </Skeleton>
    );
  }

  if (isMobile) {
    if (!entity) {
      return (
        <section className="client-detail-page entity-detail-page mobile-entity-detail-page">
          <header className="mobile-entity-header">
            <Link href={backHref} className="mobile-header-back">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mobile-back-icon">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              <span>Back</span>
            </Link>
            <h1 className="mobile-header-title">Entity Detail</h1>
            <span style={{ width: 44 }}></span>
          </header>
          <p className="entity-wizard-error" style={{ padding: 20, textAlign: "center" }}>
            {errorMessage || "Entity not found."}
          </p>
        </section>
      );
    }

    if (mobileView === "transactions") {
      return (
        <div className="mobile-entity-detail-page">
          <header className="mobile-entity-header">
            <button
              onClick={() => setMobileView("dashboard")}
              className="mobile-header-back"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mobile-back-icon">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              <span>Back</span>
            </button>
            <h1 className="mobile-header-title">Transactions</h1>
            <span style={{ width: 44 }}></span>
          </header>
          <div style={{ padding: "16px" }}>
            <AllTransactionsView
              context={{ kind: "entity", entityId }}
              addTransactionHref={entity.reconciled ? undefined : addTransactionHref}
              rulesHref={transactionRulesHref}
              rulesButtonLabel={transactionRulesLabel}
              rulesButtonClassName={transactionRulesClassName}
              rulesButtonIcon={transactionRulesIcon}
              compact
            />
          </div>
        </div>
      );
    }

    if (mobileView === "documents") {
      return (
        <div className="mobile-entity-detail-page">
          <header className="mobile-entity-header">
            <button
              onClick={() => setMobileView("dashboard")}
              className="mobile-header-back"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mobile-back-icon">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              <span>Back</span>
            </button>
            <h1 className="mobile-header-title">Documents</h1>
            <span style={{ width: 44 }}></span>
          </header>
          <div style={{ padding: "16px" }}>
            <DocumentsListView
              context={{ kind: "entity", entityId }}
              token={sessionToken}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="mobile-entity-detail-page">
        {/* Mobile Header */}
        <header className="mobile-entity-header">
          <Link href={backHref} className="mobile-header-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mobile-back-icon">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span>Back</span>
          </Link>
          <h1 className="mobile-header-title">Entity Detail</h1>
          <Link href={editEntityHref} className="mobile-header-edit">
            Edit
          </Link>
        </header>

        {/* Deep Blue Entity Overview Card */}
        <section className="mobile-entity-overview">
          <div className="mobile-entity-type-badge">
            {entity.entityType === "trust" ? "Trust - Discretionary" : entityTypeLabel(entity.entityType)}
          </div>
          <h2 className="mobile-entity-name">{entity.name}</h2>
          <p className="mobile-entity-properties-count">
            {properties.length} propert{properties.length === 1 ? "y" : "ies"}
          </p>

          <div className="mobile-stats-grid">
            <div className="mobile-stat-card">
              <span className="mobile-stat-label">Net Equity</span>
              <span className="mobile-stat-value is-green">
                {formatCurrencyStat(displayNetEquity)}
              </span>
            </div>
            <div className="mobile-stat-card">
              <span className="mobile-stat-label">
                Market Value - {properties.length} propert{properties.length === 1 ? "y" : "ies"}
              </span>
              <span className="mobile-stat-value">
                {formatCurrencyStat(displayMarketValue)}
              </span>
            </div>
            <div className="mobile-stat-card">
              <span className="mobile-stat-label">Outstanding Loan</span>
              <span className="mobile-stat-value is-orange">
                {formatCurrencyStat(displayOutstandingLoans)}
              </span>
            </div>
            <div className="mobile-stat-card">
              <span className="mobile-stat-label">Cash Flow (This Month)</span>
              <span className="mobile-stat-value is-green">
                {formatCashFlowValue(displayCashFlow)}
              </span>
            </div>
          </div>
        </section>

        {/* Profit & Loss Trend Card */}
        <section className="mobile-trend-section">
          <h3 className="mobile-section-title">Profit & Loss Trend</h3>

          <div className="mobile-chart-container">
            {mobileTrendRows.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "#667085", fontSize: "13px" }}>
                No trend data available.
              </div>
            ) : (
              <>
                <div className="mobile-chart-bars-row">
                  {mobileTrendRows.map((item, idx) => {
                    const total = item.income + item.expenses || 1;
                    const incPct = (item.income / total) * 100;
                    const expPct = (item.expenses / total) * 100;

                    return (
                      <div key={idx} className="mobile-chart-column">
                        <div className="mobile-chart-bar-stack">
                          <div className="mobile-chart-bar-income" style={{ height: `${incPct}%` }} />
                          <div className="mobile-chart-bar-expense" style={{ height: `${expPct}%` }} />
                        </div>
                        <span className="mobile-chart-label">{item.month}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mobile-chart-divider" />
                <div className="mobile-chart-legend">
                  <div className="mobile-legend-item">
                    <span className="mobile-legend-color is-income" />
                    <span>Income</span>
                  </div>
                  <div className="mobile-legend-item">
                    <span className="mobile-legend-color is-expense" />
                    <span>Expenses</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Beneficiaries Card */}
        <section className="mobile-beneficiaries-section">
          <h3 className="mobile-section-title">Beneficiaries</h3>

          <div className="mobile-beneficiaries-card">
            {displayBeneficiaries.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", color: "#667085", fontSize: "13px" }}>
                No beneficiaries listed.
              </div>
            ) : (
              <>
                {displayBeneficiaries.map((b, idx) => (
                  <div key={idx} className="mobile-beneficiary-row">
                    <div className="mobile-beneficiary-info">
                      <span className="mobile-beneficiary-name">{b.name}</span>
                      <span className="mobile-beneficiary-role">
                        {idx === 0 ? "Primary beneficiary" : "Beneficiary"}
                      </span>
                    </div>
                    <span className="mobile-beneficiary-percentage">
                      {b.ownershipPercentage}%
                    </span>
                  </div>
                ))}

                <div className="mobile-beneficiary-row is-total">
                  <span className="mobile-beneficiary-name">Total ownership</span>
                  <span className="mobile-beneficiary-percentage is-green">
                    {totalOwnership}%
                  </span>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Quick Action Buttons Row */}
        <div className="mobile-quick-actions">
          <Link href={entity.reconciled ? "#" : addTransactionHref} className="mobile-action-btn">
            <div className="mobile-action-icon-container">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 20, height: 20 }}>
                <path d="m7 15 5 5 5-5" />
                <path d="m17 9-5-5-5 5" />
              </svg>
            </div>
            <span>Add Transaction</span>
          </Link>
          <Link href={addPropertyHref} className="mobile-action-btn">
            <div className="mobile-action-icon-container">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 20, height: 20 }}>
                <path d="M3 21h18" />
                <path d="M3 10h18" />
                <path d="M5 6h14" />
                <path d="M4 10v11" />
                <path d="M20 10v11" />
              </svg>
            </div>
            <span>Add Property</span>
          </Link>
        </div>

        {/* Properties Section */}
        <section className="mobile-properties-section" style={{ margin: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <h3 className="mobile-section-title" style={{ fontSize: "16px", fontWeight: 700, color: "#475467" }}>Properties</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {displayProperties.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", background: "#ffffff", borderRadius: "16px", border: "1px solid #eaeef4", color: "#667085", fontSize: "14px" }}>
                No properties linked to this entity.
              </div>
            ) : (
              displayProperties.map((prop, idx) => {
                const isImageBroken = brokenImages[prop.id];
                const hasImageUrl = prop.imageUrl && prop.imageUrl !== "null" && prop.imageUrl !== "undefined" && prop.imageUrl.trim() !== "";

                const imgTargetSrc = prop.imageUrl && hasImageUrl
                  ? (prop.imageUrl.startsWith("http") || prop.imageUrl.startsWith("/")
                    ? prop.imageUrl
                    : `/api/documents/download?key=${encodeURIComponent(prop.imageUrl)}`)
                  : "";

                return (
                  <Link
                    key={`${prop.id}-${idx}`}
                    href={`${propertyDetailHrefBase}/${prop.id}`}
                    className="mobile-property-card"
                    style={{ textDecoration: "none", color: "inherit", display: "flex", background: "#ffffff", border: "1px solid #eaeef4", borderRadius: "16px", padding: "12px", gap: "12px", boxShadow: "0 4px 12px rgba(16,24,40,0.01)" }}
                  >
                    {hasImageUrl && !isImageBroken ? (
                      <img
                        src={imgTargetSrc}
                        alt={prop.name}
                        style={{ width: "90px", height: "90px", borderRadius: "12px", objectFit: "cover", backgroundColor: "#f2f4f7" }}
                        onError={() => setBrokenImages(prev => ({ ...prev, [prop.id]: true }))}
                      />
                    ) : (
                      <div
                        style={{
                          width: "90px",
                          height: "90px",
                          borderRadius: "12px",
                          backgroundColor: "#f2f4f7",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#98a2b3",
                          flexShrink: 0
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "36px", height: "36px" }}>
                          <rect x="3" y="3" width="18" height="18" rx="4" />
                          <circle cx="8.5" cy="8.5" r="2" />
                          <path d="M3 19c2.5-3.5 6-3.5 9 0 2.5-3.5 6-7 9-3" />
                        </svg>
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: "4px" }}>
                      <strong style={{ fontSize: "15px", fontWeight: 700, color: "#101828" }}>{prop.name}</strong>

                      <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#667085" }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "12px", height: "12px" }}>
                          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                        </svg>
                        <span>{prop.entityName}</span>
                      </div>

                      <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "#475467", marginTop: "4px" }}>
                        <span>Income <strong style={{ color: "#12b76a" }}>{prop.incomeText}</strong></span>
                        <span>Expense <strong style={{ color: "#344054" }}>{prop.expenseText}</strong></span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: "12px",
                            backgroundColor: prop.status === "Rented" ? "#d1fadf" : "#f2f4f7",
                            color: prop.status === "Rented" ? "#027a48" : "#344054"
                          }}
                        >
                          {prop.status}
                        </span>
                        <span style={{ fontSize: "12px", color: "#475467" }}>
                          Net <strong style={{ color: prop.netVal >= 0 ? "#12b76a" : "#f04438" }}>{prop.netText}</strong>
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        {/* Recent Transactions Section */}
        <section className="mobile-transactions-section" style={{ margin: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 className="mobile-section-title" style={{ fontSize: "16px", fontWeight: 700, color: "#475467" }}>Recent Transactions</h3>
            <button
              onClick={() => setMobileView("transactions")}
              style={{ background: "none", border: "none", color: "#1b265c", fontSize: "14px", fontWeight: 700, cursor: "pointer", padding: 0 }}
            >
              View all
            </button>
          </div>

          <div className="mobile-transactions-card" style={{ background: "#ffffff", border: "1px solid #eaeef4", borderRadius: "16px", padding: displayRecentTransactions.length === 0 ? "24px" : "0 16px", boxShadow: "0 4px 12px rgba(16,24,40,0.01)" }}>
            {displayRecentTransactions.length === 0 ? (
              <div style={{ textAlign: "center", color: "#667085", fontSize: "14px" }}>
                No transactions recorded yet.
              </div>
            ) : (
              displayRecentTransactions.map((tx, idx) => (
                <div
                  key={tx.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "16px 0",
                    borderBottom: idx < displayRecentTransactions.length - 1 ? "1px solid #f2f4f7" : "none",
                    gap: "12px"
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: tx.isRevenue ? "#d1fadf" : "#fee4e2",
                      color: tx.isRevenue ? "#027a48" : "#d92d20"
                    }}
                  >
                    {tx.isRevenue ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.0" style={{ width: "16px", height: "16px" }}>
                        <line x1="7" y1="17" x2="17" y2="7" />
                        <polyline points="7 7 17 7 17 17" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.0" style={{ width: "16px", height: "16px" }}>
                        <line x1="17" y1="7" x2="7" y2="17" />
                        <polyline points="17 17 7 17 7 7" />
                      </svg>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: "2px" }}>
                    <strong style={{ fontSize: "14px", fontWeight: 700, color: "#101828" }}>{tx.description}</strong>
                    <span style={{ fontSize: "12px", color: "#667085" }}>{tx.categoryMeta}</span>
                  </div>

                  <span style={{ fontSize: "15px", fontWeight: 700, color: tx.isRevenue ? "#027a48" : "#344054" }}>
                    {tx.amountText}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Documents Section */}
        <section className="mobile-documents-section" style={{ margin: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 className="mobile-section-title" style={{ fontSize: "16px", fontWeight: 700, color: "#475467" }}>Documents</h3>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                onClick={() => setMobileView("documents")}
                style={{ background: "none", border: "none", color: "#1b265c", fontSize: "14px", fontWeight: 700, cursor: "pointer", padding: 0 }}
              >
                View all
              </button>
              <button
                onClick={() => mobileFileInputRef.current?.click()}
                style={{
                  backgroundColor: "#1b265c",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "20px",
                  padding: "6px 16px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                Add
              </button>
            </div>
          </div>

          <input
            ref={mobileFileInputRef}
            type="file"
            multiple
            onChange={handleMobileUploadFile}
            accept=".pdf,.png,.jpg,.jpeg"
            style={{ display: "none" }}
          />

          <div className="mobile-documents-card" style={{ background: "#ffffff", border: "1px solid #eaeef4", borderRadius: "16px", padding: "8px 16px", boxShadow: "0 4px 12px rgba(16,24,40,0.01)" }}>
            {isMobileUploading && (
              <div style={{ padding: "12px 0", fontSize: "13px", color: "#667085", display: "flex", alignItems: "center", gap: "8px" }}>
                <div className="spinner" style={{ width: "16px", height: "16px", border: "2px solid #eaecf0", borderTopColor: "#1b265c", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <span>Uploading file...</span>
              </div>
            )}

            {isMobileDocsLoading && mobileDocs.length === 0 ? (
              <div style={{ padding: "16px 0", textAlign: "center", fontSize: "13px", color: "#667085" }}>Loading documents...</div>
            ) : mobileDocs.length === 0 ? (
              <div style={{ padding: "24px 0", textAlign: "center", fontSize: "13px", color: "#667085" }}>
                No documents uploaded yet.
              </div>
            ) : (
              mobileDocs.slice(0, 3).map((doc, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "12px 0",
                    borderBottom: idx < Math.min(mobileDocs.length, 3) - 1 ? "1px solid #f2f4f7" : "none",
                    gap: "12px"
                  }}
                >
                  <div style={{ color: "#667085" }}>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: "2px", minWidth: 0 }}>
                    <strong style={{ fontSize: "13px", fontWeight: 700, color: "#101828", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.original_file_name || doc.file_name}
                    </strong>
                    <span style={{ fontSize: "11px", color: "#667085" }}>
                      {doc.document_type ? titleCase(doc.document_type) : titleCase(doc.mime_type)} • {(doc.file_size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    );
  }

  if (isEntityLoading) {
    return (
      <Skeleton
        name="entity-detail-page"
        loading
        fallback={<EntityDetailSkeleton />}
      >
        <EntityDetailSkeleton />
      </Skeleton>
    );
  }

  if (!entity) {
    return (
      <section className="client-detail-page entity-detail-page">
        <Link href={backHref} className="entity-wizard-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back to {backLabel}
        </Link>
        <p className="entity-wizard-error">
          {errorMessage || "Entity not found."}
        </p>
      </section>
    );
  }

  return (
    <section className="client-detail-page entity-detail-page">
      <Link href={backHref} className="entity-wizard-back">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Back to {backLabel}
      </Link>

      <header className="entity-page-header">
        <div>
          <h1>
            {entity.name}
            {entity.reconciled && (
              <span className="entity-reconciled-badge" title="This entity has been reconciled and is locked">
                Reconciled
              </span>
            )}
          </h1>
          <p>
            {entityTypeLabel(entity.entityType)} · {ownerCopy} ·{" "}
            {properties.length} propert{properties.length === 1 ? "y" : "ies"}
          </p>
        </div>
        {!entity.reconciled && (
          <Link
            href={editEntityHref}
            className="entity-icon-action entity-detail-edit-action"
            aria-label={`Edit ${entity.name}`}
            title="Edit entity"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            <span>Edit Details</span>
          </Link>
        )}
      </header>

      {entity.reconciled && (
        <div className="entity-reconciled-notice" role="status">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="entity-reconciled-notice-icon" width={20} height={20}>
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <div>
            <strong>Reconciliation Completed</strong>
            <p>
              This entity has been reconciled and is now read-only.
              No further transactions, statements, or edits can be made.
            </p>
          </div>
        </div>
      )}

      {isTransactionsLoading ? (
        <TrendSkeleton />
      ) : (
        <section className="entity-trend-card" aria-label="Profit and loss trend">
          <div className="entity-trend-head">
            <h2>Profit & Loss Trend</h2>
            <div className="entity-trend-toggle">
              <span
                className={trendView === "graph" ? "is-active" : ""}
                onClick={() => setTrendView("graph")}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M4 19V5" />
                  <path d="M4 19h16" />
                  <path d="M8 17V9" />
                  <path d="M13 17V6" />
                  <path d="M18 17v-5" />
                </svg>
                Graph View
              </span>
              <span
                className={trendView === "table" ? "is-active" : ""}
                onClick={() => setTrendView("table")}
              >
                <svg viewBox="0 0 24 24">
                  <rect x="4" y="5" width="16" height="14" rx="1" />
                  <path d="M4 10h16" />
                  <path d="M4 15h16" />
                  <path d="M10 5v14" />
                </svg>
                Table View
              </span>
            </div>
          </div>

          {trendRows.length === 0 ? (
            <div className="property-trend-empty">
              No transactions are available for this entity yet.
            </div>
          ) : trendView === "graph" ? (
            <>
              <div className="entity-chart">
                <div className="entity-chart-y">
                  <span>{formatCurrency(maxTrendAmount)}</span>
                  <span>{formatCurrency(maxTrendAmount * 0.75)}</span>
                  <span>{formatCurrency(maxTrendAmount * 0.5)}</span>
                  <span>{formatCurrency(maxTrendAmount * 0.25)}</span>
                  <span>{formatCurrency(0)}</span>
                </div>
                <div className="entity-chart-plot">
                  {trendRows.map((item) => (
                    <div key={item.month} className="entity-chart-month">
                      <div className="entity-chart-bars">
                        <span
                          className="is-expense"
                          style={{
                            height: `${Math.max(
                              3,
                              (item.expenses / maxTrendAmount) * 100,
                            )}%`,
                          }}
                        />
                        <span
                          className="is-income"
                          style={{
                            height: `${Math.max(
                              3,
                              (item.income / maxTrendAmount) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                      <span>{monthLabel(item.month)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="entity-chart-legend">
                <span>
                  <i className="is-expense" />
                  Expenses
                </span>
                <span>
                  <i className="is-income" />
                  Income
                </span>
              </div>
            </>
          ) : (
            <div className="property-trend-table-full">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Income</th>
                    <th>Expenses</th>
                    <th>Net Result</th>
                  </tr>
                </thead>
                <tbody>
                  {trendRows.map((item) => {
                    const net = item.income - item.expenses;
                    const isPositive = net >= 0;
                    return (
                      <tr key={item.month}>
                        <td>{monthLabel(item.month)}</td>
                        <td className="income-col">
                          <span className="dot">●</span> {formatCurrency(item.income)}
                        </td>
                        <td className="expense-col">
                          <span className="dot">●</span> {formatCurrency(item.expenses)}
                        </td>
                        <td className={isPositive ? "income-col" : "expense-col"}>
                          {isPositive ? "+" : "-"}{formatCurrency(Math.abs(net))}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="total-row">
                    <td>Total</td>
                    <td>{formatCurrency(trendTotals.income)}</td>
                    <td>{formatCurrency(trendTotals.expenses)}</td>
                    <td className={trendNetTotal >= 0 ? "income-col" : "expense-col"}>
                      {trendNetTotal >= 0 ? "+" : "-"}{formatCurrency(Math.abs(trendNetTotal))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Regional Manager Section */}
      <section className="entity-trend-card entity-rm-card" aria-label="Regional Manager" style={{ padding: "24px 34px 28px" }}>
        <div className="entity-trend-head" style={{ marginBottom: 20 }}>
          <h2>Regional Manager</h2>
        </div>

        <div className="entity-rm-content">
          {/* Left Side: Avatar + Details */}
          <div className="entity-rm-info-section">
            <div className={`entity-rm-avatar-wrapper ${selectedRm ? "is-assigned" : ""}`}>
              {selectedRm ? (
                avatarInitials
              ) : (
                <svg className="entity-rm-avatar-icon" viewBox="0 0 24 24" aria-hidden="true" style={{ width: 22, height: 22, stroke: "#98a2b3" }}>
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </div>

            <div className="entity-rm-text-details">
              <h3 className="entity-rm-status-title" style={{ fontSize: 16, fontWeight: 700, color: "#1d2939" }}>
                {selectedRm ? selectedRm.name : "No Regional Manager Assigned"}
              </h3>
              {selectedRm ? (
                <div className="entity-rm-assigned-meta">
                  <span className="entity-rm-badge">Regional Manager</span>
                  <span className="entity-rm-meta-item">
                    <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14">
                      <rect x="3" y="4" width="18" height="14" rx="2" />
                      <path d="m3 7 9 6 9-6" />
                    </svg>
                    {selectedRm.email}
                  </span>
                </div>
              ) : (
                <p className="entity-rm-status-subtitle" style={{ fontSize: 13, color: "#667085", marginTop: 4 }}>
                  Please select a regional manager from the dropdown below to assign them to this entity.
                </p>
              )}
            </div>
          </div>

          {/* Right Side: Select Input (only visible when no RM is assigned) */}
          {/* Right Side: Select Input or Delete/Remove Button */}
          {!selectedRm ? (
            <div className="entity-rm-action-section">
              <label className="entity-rm-label" htmlFor="rm-dropdown-select" style={{ fontSize: 12, fontWeight: 600, color: "#344054", marginBottom: 6 }}>
                Select Regional Manager
              </label>
              <div className="entity-rm-select-wrapper">
                <select
                  id="rm-dropdown-select"
                  className="entity-rm-select"
                  value={selectedRmId}
                  onChange={(e) => handleAssignRm(e.target.value)}
                  style={{
                    color: selectedRmId === "" ? "#98a2b3" : "#101828",
                  }}
                >
                  <option value=""></option>
                  {availableManagers.map((rm) => (
                    <option key={rm.id} value={rm.id}>
                      {rm.name}
                    </option>
                  ))}
                </select>
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    right: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 16,
                    height: 16,
                    pointerEvents: "none",
                    stroke: "#667085",
                    strokeWidth: 2,
                    fill: "none"
                  }}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
          ) : (
            <div className="entity-rm-action-section" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => handleAssignRm("")}
                title="Remove Regional Manager"
                aria-label="Remove Regional Manager"
                style={{
                  background: "transparent",
                  border: "1px solid #f2f4f7",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  cursor: "pointer",
                  color: "#667085",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#fef3f2";
                  e.currentTarget.style.borderColor = "#fee4e2";
                  e.currentTarget.style.color = "#d92d20";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.borderColor = "#f2f4f7";
                  e.currentTarget.style.color = "#667085";
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.0"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
                <span>Remove</span>
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="entity-resource-panel">
        <div className="entity-resource-tabs" role="tablist" aria-label="Entity resources">
          {entityTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={currentTab === tab.id}
              className={currentTab === tab.id ? "is-active" : ""}
              onClick={() => setCurrentTab(tab.id)}
            >
              {tab.label}
              {tab.id === "reconciliation" && (
                <span className="entity-tab-alpha-badge">Alpha</span>
              )}
            </button>
          ))}
        </div>

        {currentTab === "properties" && (
          <div className="entity-resource-body">
            <div className="entity-resource-head">
              <h2>Entity Property</h2>
              <Link href={addPropertyHref} className="entity-wizard-primary is-green">
                + Add Property
              </Link>
            </div>

            {isPropertiesLoading ? (
              <EntityPropertyListSkeleton />
            ) : properties.length === 0 ? (
              <div className="client-detail-empty">
                <p>No properties have been linked to this entity yet.</p>
              </div>
            ) : (
              <ul className="entity-property-list">
                {properties.map((property, idx) => (
                  <li key={`${property.id}-${idx}`} className="entity-property-row">
                    <div className="entity-property-main">
                      <Link
                        href={`${propertyDetailHrefBase}/${property.id}`}
                        className="entity-property-title-link"
                      >
                        {property.reconciled && (
                          <span className="entity-property-reconciled-badge">Reconciled</span>
                        )}
                        <strong>{property.name}</strong>
                      </Link>
                      <span>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z" />
                          <circle cx="12" cy="10" r="2.5" />
                        </svg>
                        {property.locationText}
                      </span>
                    </div>
                    <dl>
                      <div>
                        <dt>Property Type</dt>
                        <dd>{titleCase(property.propertyType)}</dd>
                      </div>
                      <div>
                        <dt>Date Added</dt>
                        <dd>{formatDate(property.createdAt)}</dd>
                      </div>
                      <div>
                        <dt>Total Transactions</dt>
                        <dd>
                          {isTransactionsLoading
                            ? "..."
                            : transactions.filter((t) =>
                              t.propertyIds?.includes(property.id),
                            ).length}
                        </dd>
                      </div>
                    </dl>
                    {entity.reconciled ? (
                      <span className="entity-property-disabled-action" title="Entity is reconciled">
                        + Add Transaction
                      </span>
                    ) : (
                      <Link
                        href={appendQueryParam(
                          addTransactionHref,
                          "propertyId",
                          property.id,
                        )}
                        className="entity-property-disabled-action"
                      >
                        + Add Transaction
                      </Link>
                    )}
                    <Link
                      href={`${propertyDetailHrefBase}/${property.id}`}
                      className="entity-property-chevron-link"
                      aria-label={`Open ${property.name}`}
                    >
                      <svg className="entity-property-chevron" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {currentTab === "transactions" && (
          <div className="entity-resource-body">
            <AllTransactionsView
              context={{ kind: "entity", entityId }}
              addTransactionHref={entity.reconciled ? undefined : addTransactionHref}
              rulesHref={transactionRulesHref}
              rulesButtonLabel={transactionRulesLabel}
              rulesButtonClassName={transactionRulesClassName}
              rulesButtonIcon={transactionRulesIcon}
              compact
            />

          </div>
        )}

        {currentTab === "reconciliation" && (
          <div className="entity-resource-body">
            <div className="entity-resource-head">
              <h2>Bank Reconciliations</h2>
              <button
                type="button"
                className="entity-wizard-primary is-green"
                onClick={() => setNewSessionOpen((v) => !v)}
              >
                {newSessionOpen ? "Cancel" : "+ New Reconciliation"}
              </button>
            </div>

            {newSessionOpen && (
              <form
                onSubmit={handleCreateSession}
                className="recon-session-form"
                style={{
                  display: "grid",
                  gap: 12,
                  padding: 16,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>Label</span>
                  <input
                    type="text"
                    value={newSessionLabel}
                    onChange={(e) => setNewSessionLabel(e.target.value)}
                    placeholder="e.g. FY26 Q1"
                    maxLength={120}
                    required
                    style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }}
                  />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>Period from (optional)</span>
                    <input
                      type="date"
                      value={newSessionFrom}
                      onChange={(e) => setNewSessionFrom(e.target.value)}
                      style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>Period to (optional)</span>
                    <input
                      type="date"
                      value={newSessionTo}
                      onChange={(e) => setNewSessionTo(e.target.value)}
                      style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }}
                    />
                  </label>
                </div>
                {newSessionError && (
                  <p style={{ color: "#dc2626", fontSize: 13, margin: 0 }}>{newSessionError}</p>
                )}
                <div>
                  <button
                    type="submit"
                    className="entity-wizard-primary is-green"
                    disabled={newSessionSaving}
                  >
                    {newSessionSaving ? "Creating…" : "Create & Open"}
                  </button>
                </div>
              </form>
            )}

            {sessionListLoading ? (
              <div className="client-detail-empty"><p>Loading…</p></div>
            ) : sessionList.length === 0 ? (
              <div className="client-detail-empty">
                <p>No reconciliations yet. Create one to start uploading bank statements.</p>
              </div>
            ) : (
              <ul className="entity-property-list">
                {sessionList.map((s) => {
                  const created = s.createdAt
                    ? new Date(s.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
                    : "—";
                  const period = s.periodFrom && s.periodTo
                    ? `${s.periodFrom} → ${s.periodTo}`
                    : s.periodFrom || s.periodTo || "—";
                  const statusColor = s.status === "completed"
                    ? "var(--color-success, #16a34a)"
                    : "var(--color-warning, #ca8a04)";
                  return (
                    <li key={s.id} className="entity-property-row">
                      <div className="entity-property-main">
                        <strong>{s.label}</strong>
                        <span style={{ color: statusColor, fontWeight: 600, textTransform: "capitalize", fontSize: 13 }}>
                          {s.status}
                        </span>
                      </div>
                      <dl>
                        <div>
                          <dt>Statements</dt>
                          <dd>{s.statementCount}</dd>
                        </div>
                        <div>
                          <dt>Period</dt>
                          <dd>{period}</dd>
                        </div>
                        <div>
                          <dt>Created</dt>
                          <dd>{created}</dd>
                        </div>
                      </dl>
                      {reconciliationHref && (
                        <Link
                          href={`${reconciliationHref}/${encodeURIComponent(s.id)}`}
                          className="entity-property-chevron-link"
                          aria-label="Open reconciliation"
                        >
                          <svg className="entity-property-chevron" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="m9 6 6 6-6 6" />
                          </svg>
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {currentTab === "documents" && (
          <div className="entity-resource-body">
            <DocumentsListView
              context={{ kind: "entity", entityId }}
              token={sessionToken}
            />
          </div>
        )}

        {currentTab !== "properties" && currentTab !== "transactions" && currentTab !== "reconciliation" && currentTab !== "documents" && (
          <div className="entity-coming-soon">
            <strong>{entityTabs.find((tab) => tab.id === currentTab)?.label}</strong>
            <p>Coming soon</p>
          </div>
        )}
      </section>
    </section>
  );
}
