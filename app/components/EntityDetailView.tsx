"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getSession } from "@/src/lib/session";
import type { CoreEntity, CoreProperty } from "@/src/lib/coreApi";

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
};

type EntityTab = "properties" | "transactions" | "documents";

const entityTabs: { id: EntityTab; label: string }[] = [
  { id: "properties", label: "Properties" },
  { id: "transactions", label: "Transactions" },
  { id: "documents", label: "Documents" },
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

export default function EntityDetailView({
  entityId,
  backHref,
  backLabel,
  addPropertyHref,
}: EntityDetailViewProps) {
  const router = useRouter();
  const [entity, setEntity] = useState<CoreEntity | null>(null);
  const [properties, setProperties] = useState<CoreProperty[]>([]);
  const [currentTab, setCurrentTab] = useState<EntityTab>("properties");
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

        const [entityRes, propertiesRes] = await Promise.all([
          fetch(`/api/entities/${encodeURIComponent(entityId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/entities/${encodeURIComponent(entityId)}/properties`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (cancelled) return;

        if (!entityRes.ok) {
          setErrorMessage("Failed to load entity.");
          return;
        }

        setEntity((await entityRes.json()) as CoreEntity);

        if (propertiesRes.ok) {
          const data = (await propertiesRes.json()) as { items?: CoreProperty[] };
          setProperties(data.items || []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load entity detail:", error);
          setErrorMessage("Unexpected error loading entity.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (entityId) load();
    return () => {
      cancelled = true;
    };
  }, [entityId, router]);

  const ownerCopy = useMemo(() => {
    if (!entity) return "";
    if (entity.beneficiaries.length === 1) return "1 shareholder";
    return `${entity.beneficiaries.length} shareholders`;
  }, [entity]);

  if (isLoading) {
    return (
      <section className="client-detail-page entity-detail-page">
        <p>Loading entity...</p>
      </section>
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
          <h1>{entity.name}</h1>
          <p>
            {entityTypeLabel(entity.entityType)} · {ownerCopy} ·{" "}
            {properties.length} propert{properties.length === 1 ? "y" : "ies"}
          </p>
        </div>
      </header>

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

            {properties.length === 0 ? (
              <div className="client-detail-empty">
                <p>No properties have been linked to this entity yet.</p>
              </div>
            ) : (
              <ul className="entity-property-list">
                {properties.map((property) => (
                  <li key={property.id} className="entity-property-row">
                    <div className="entity-property-main">
                      <strong>{property.name}</strong>
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
                        <dd>0</dd>
                      </div>
                    </dl>
                    <button type="button" className="entity-property-disabled-action">
                      + Add Transaction
                    </button>
                    <svg className="entity-property-chevron" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {currentTab !== "properties" && (
          <div className="entity-coming-soon">
            <strong>{entityTabs.find((tab) => tab.id === currentTab)?.label}</strong>
            <p>Coming soon</p>
          </div>
        )}
      </section>
    </section>
  );
}
