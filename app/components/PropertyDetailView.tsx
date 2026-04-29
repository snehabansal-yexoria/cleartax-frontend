"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "boneyard-js/react";
import { PropertyDetailSkeleton } from "@/app/components/PortalSkeletons";
import { getSession } from "@/src/lib/session";
import type { CoreEntity, CoreProperty } from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

export type PropertyDetailViewProps = {
  propertyId: string;
  backHref: string;
  backLabel: string;
};

type PropertyTab = "transactions" | "documents" | "rules";

const propertyTabs: { id: PropertyTab; label: string }[] = [
  { id: "transactions", label: "Transactions" },
  { id: "documents", label: "Documents" },
  { id: "rules", label: "Transaction Rules" },
];

const trendMonths = [
  { month: "Oct", expenses: 61, income: 54 },
  { month: "Nov", expenses: 61, income: 74 },
  { month: "Dec", expenses: 61, income: 74 },
  { month: "Jan", expenses: 61, income: 61 },
  { month: "Feb", expenses: 61, income: 67 },
  { month: "Mar", expenses: 49, income: 43 },
  { month: "Apr", expenses: 61, income: 66 },
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
  backHref,
  backLabel,
}: PropertyDetailViewProps) {
  const router = useRouter();
  const [property, setProperty] = useState<CoreProperty | null>(null);
  const [entity, setEntity] = useState<CoreEntity | null>(null);
  const [currentTab, setCurrentTab] = useState<PropertyTab>("transactions");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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

  const loanAmount = useMemo(() => getLoanAmount(property), [property]);

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
            <button type="button" className="property-outline-button">
              Edit Details
            </button>
            <button type="button" className="property-review-button">
              Review Form
            </button>
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
            <dd>0</dd>
          </div>
        </dl>
      </header>

      <div className="client-stat-grid property-metric-grid">
        <article className="client-stat-card">
          <span>Total Income</span>
          <strong>$0</strong>
        </article>
        <article className="client-stat-card">
          <span>Total Expenses</span>
          <strong>$0</strong>
        </article>
        <article className="client-stat-card">
          <span>Net Profit</span>
          <strong className="is-profit">$0</strong>
        </article>
      </div>

      <section className="entity-trend-card" aria-label="Profit and loss trend">
        <div className="entity-trend-head">
          <h2>Profit & Loss Trend</h2>
          <div className="entity-trend-toggle" aria-hidden="true">
            <span className="is-active">
              <svg viewBox="0 0 24 24">
                <path d="M4 19V5" />
                <path d="M4 19h16" />
                <path d="M8 17V9" />
                <path d="M13 17V6" />
                <path d="M18 17v-5" />
              </svg>
              Graph View
            </span>
            <span>
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

        <div className="entity-chart">
          <div className="entity-chart-y">
            <span>$6k</span>
            <span>$4.5k</span>
            <span>$3k</span>
            <span>$1.5k</span>
            <span>$0k</span>
          </div>
          <div className="entity-chart-plot">
            {trendMonths.map((item) => (
              <div key={item.month} className="entity-chart-month">
                <div className="entity-chart-bars">
                  <span
                    className="is-expense"
                    style={{ height: `${item.expenses}%` }}
                  />
                  <span
                    className="is-income"
                    style={{ height: `${item.income}%` }}
                  />
                </div>
                <span>{item.month}</span>
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
      </section>

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
          <strong>{propertyTabs.find((tab) => tab.id === currentTab)?.label}</strong>
          <p>Coming soon</p>
        </div>
      </section>
    </section>
  );
}
