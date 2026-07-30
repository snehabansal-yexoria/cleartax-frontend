"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "boneyard-js/react";
import ToggleSwitch from "@/app/components/ToggleSwitch";
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
  const pathname = usePathname();
  // The client dashboard reuses this view; only accountants manage the flag.
  const isClientView = (pathname || "").startsWith("/dashboard/client");

  async function handleToggleEnabled(next: boolean) {
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
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.message || data.error || `Failed to ${next ? "enable" : "disable"} property`,
        );
      }
      setProperty({ ...previous, ...data });
    } catch (err) {
      setProperty(previous);
      setEnabledError(
        err instanceof Error
          ? err.message
          : `Failed to ${next ? "enable" : "disable"} property. Please try again.`,
      );
    } finally {
      setIsTogglingEnabled(false);
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

      {writesBlocked && (
        <div className="entity-disabled-notice" role="status">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="entity-reconciled-notice-icon" width={20} height={20}>
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12h8" />
          </svg>
          <div>
            <strong>{entityDisabled ? "Entity Disabled" : "Property Disabled"}</strong>
            <p>
              {entityDisabled
                ? "The parent entity is disabled. All changes are blocked until it is re-enabled."
                : "This property is disabled. All changes are blocked until it is re-enabled."}
            </p>
          </div>
        </div>
      )}

      <header className="client-detail-entities property-hero-card">
        <div className="property-hero-top">
          <div>
            <h1>
              {property.name}
              {propertyDisabled && (
                <span className="entity-disabled-badge" title="This property is disabled and cannot be modified">
                  Disabled
                </span>
              )}
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
                onChange={(checked) => handleToggleEnabled(checked)}
                disabled={entityDisabled}
                loading={isTogglingEnabled}
                green
                label={propertyDisabled ? "Disabled" : "Enabled"}
                title={
                  entityDisabled
                    ? "Enable the entity first"
                    : propertyDisabled
                      ? "Enable this property"
                      : "Disable this property"
                }
              />
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
            />
          </div>
        ) : currentTab === "rules" ? (
          <div className="property-rules-tab-wrapper">
            <TransactionRulesView
              backHref={backHref}
              entityId={entityId || property?.entityId}
              isPropertyPage={true}
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
                  entityDisabled ? "Entity is disabled" : "Property is disabled"
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
  );
}
