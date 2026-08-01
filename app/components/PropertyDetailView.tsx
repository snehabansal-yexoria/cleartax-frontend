"use client";

import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
  CoreProperty,
  CorePropertyTransactionRow,
} from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

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
  const [isExporting, setIsExporting] = useState(false);
  const pathname = usePathname();
  const params = useParams<{ clientId?: string }>();
  const clientId = params?.clientId;
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

  async function handleExportCsv() {
    if (isExporting || !clientId) return;
    try {
      setIsExporting(true);
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) return;
      const token = session.getIdToken().getJwtToken();
      const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/export-csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.error("Export CSV failed", res.status);
        alert("Failed to export client data. Please try again.");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] || `${property?.name || propertyId}_Export.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export CSV error:", error);
      alert("Something went wrong while exporting. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "transactions" || tab === "documents" || tab === "rules") {
      setCurrentTab(tab);
    }
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
            <div className="property-hero-actions">
              {!isClientView && (
                <ToggleSwitch
                  checked={!propertyDisabled}
                  onChange={(checked) => {
                    if (!checked) {
                      setIsInactiveModalOpen(true);
                    } else {
                      handleToggleEnabled(true);
                    }
                  }}
                  disabled={entityDisabled}
                  loading={isTogglingEnabled}
                  green
                  label={propertyDisabled ? "Inactive" : "Active"}
                  title={
                    entityDisabled
                      ? "Activate the entity first"
                      : propertyDisabled
                        ? "Activate this property"
                        : "Deactivate this property"
                  }
                />
              )}
              {!isClientView && clientId && (
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={isExporting}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 16px",
                    border: "1px solid #d0d5dd",
                    borderRadius: "8px",
                    background: "#ffffff",
                    color: "#344054",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: isExporting ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                    boxShadow: "0 1px 2px rgba(16, 24, 40, 0.05)",
                    opacity: isExporting ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isExporting) {
                      e.currentTarget.style.background = "#f9fafb";
                      e.currentTarget.style.borderColor = "#c6cacc";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#ffffff";
                    e.currentTarget.style.borderColor = "#d0d5dd";
                  }}
                >
                  {isExporting ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "16px", height: "16px", animation: "spin 0.9s linear infinite" }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "16px", height: "16px" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                    </svg>
                  )}
                  {isExporting ? "Exporting…" : "Export CSV"}
                </button>
              )}
              {!writesBlocked && (
                <>
                  <Link href={editPropertyHref} className="property-outline-button">
                    Edit Details
                  </Link>
                  <Link
                    href={
                      reviewFormHref ||
                      editPropertyHref.replace(/\/edit$/, "/logit-form-review")
                    }
                    className="property-review-button"
                  >
                    Review Form
                  </Link>
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
          <article className="client-stat-card">
            <span>Total Income</span>
            <strong>{formatCurrency(transactionSummary.income)}</strong>
          </article>
          <article className="client-stat-card">
            <span>Total Expenses</span>
            <strong>{formatCurrency(transactionSummary.expenses)}</strong>
          </article>
          <article className="client-stat-card">
            <span>Net Profit</span>
            <strong className={transactionSummary.net >= 0 ? "is-profit" : ""}>
              {formatCurrency(transactionSummary.net)}
            </strong>
          </article>
        </div>

        <ProfitLossTrendCard
          transactions={transactions}
          isLoading={isLoading}
        />

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
    </>
  );
}
