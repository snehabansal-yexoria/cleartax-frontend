"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "boneyard-js/react";
import { DocumentVault } from "@/app/components/DocumentVault";
import { PropertyDetailSkeleton } from "@/app/components/PortalSkeletons";
import {
  ProfitLossTrend,
  type ProfitLossTrendItem,
} from "@/app/components/ProfitLossTrend";
import {
  AllTransactionsView,
  TransactionRulesView,
} from "@/app/components/TransactionsFeature";
import { getSession } from "@/src/lib/session";
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
  clientId?: string;
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
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
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
  clientId,
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
  const [trendLoading, setTrendLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sessionToken, setSessionToken] = useState("");

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

        const propertyRes = await fetch(
          `/api/properties/${encodeURIComponent(propertyId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (cancelled) return;
        if (!propertyRes.ok) {
          setErrorMessage("Failed to load property.");
          return;
        }

        const loadedProperty = (await propertyRes.json()) as CoreProperty;
        setProperty(loadedProperty);

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

  useEffect(() => {
    if (!sessionToken || !propertyId) return;
    let cancelled = false;

    async function loadTrend() {
      try {
        setTrendLoading(true);
        setTransactions([]);
        const res = await fetch(
          `/api/properties/${encodeURIComponent(propertyId)}/transactions`,
          { headers: { Authorization: `Bearer ${sessionToken}` } },
        );

        if (!res.ok || cancelled) {
          if (!cancelled) setTransactions([]);
          return;
        }

        const data = (await res.json()) as {
          items?: CorePropertyTransactionRow[];
        };
        if (!cancelled) setTransactions(data.items || []);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load property profit and loss trend:", error);
          setTransactions([]);
        }
      } finally {
        if (!cancelled) setTrendLoading(false);
      }
    }

    loadTrend();
    return () => {
      cancelled = true;
    };
  }, [propertyId, sessionToken]);

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
  const trendItems: ProfitLossTrendItem[] = transactions.map((row) => ({
    id: String(row.splitId || row.transactionId),
    invoiceDate: row.invoiceDate,
    type: row.transactionType,
    amount: row.splitGrossAmount || row.transactionGrossAmount,
  }));

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

  return (
    <section className="client-detail-page property-detail-page property-detail-shell">
      <Link href={backHref} className="entity-wizard-back">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Back to {backLabel}
      </Link>

      <header className="client-detail-entities property-hero-card">
        <div className="property-hero-top">
          <div>
            <h1>{property.name}</h1>
            <p>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              {property.locationText}
            </p>
          </div>
          <div className="property-hero-actions">
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

      <ProfitLossTrend
        items={trendItems}
        isLoading={trendLoading}
        emptyMessage="No transactions are available for this property yet."
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
        <div className="property-detail-tab-body">
          {currentTab === "transactions" ? (
            <div className="border border-black">
            <AllTransactionsView
              context={{ kind: "property", propertyId }}
              addTransactionHref={`${backHref}/transactions/new?propertyId=${encodeURIComponent(propertyId)}`}
              compact
            />
            </div>
          ) : currentTab === "rules" ? (
            <TransactionRulesView backHref={backHref} entityId={entityId} />
          ) : (
            <DocumentVault
              scope={{ clientId, entityId, propertyIds: [propertyId] }}
            />
          )}
        </div>
      </section>
    </section>
  );
}
