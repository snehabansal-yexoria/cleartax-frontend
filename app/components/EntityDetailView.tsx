"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "boneyard-js/react";
import { DocumentVault } from "@/app/components/DocumentVault";
import { EntityDetailSkeleton } from "@/app/components/PortalSkeletons";
import {
  ProfitLossTrend,
  type ProfitLossTrendItem,
} from "@/app/components/ProfitLossTrend";
import { AllTransactionsView } from "@/app/components/TransactionsFeature";
import { getSession } from "@/src/lib/session";
import type {
  CoreEntity,
  CoreProperty,
  CoreTransactionListItem,
  ReconciliationListItem,
} from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

export type EntityDetailViewProps = {
  clientId?: string;
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

export default function EntityDetailView({
  clientId,
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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [trendLoading, setTrendLoading] = useState(false);
  const [reconList, setReconList] = useState<ReconciliationListItem[]>([]);
  const [reconListLoading, setReconListLoading] = useState(false);

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "properties" || tab === "transactions" || tab === "documents" || tab === "reconciliation") {
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

  useEffect(() => {
    if (!sessionToken || !entityId) return;
    let cancelled = false;

    async function loadTrend() {
      try {
        setTrendLoading(true);
        setTransactions([]);
        const res = await fetch(
          `/api/entities/${encodeURIComponent(entityId)}/transactions`,
          { headers: { Authorization: `Bearer ${sessionToken}` } },
        );

        if (!res.ok || cancelled) {
          if (!cancelled) setTransactions([]);
          return;
        }

        const data = (await res.json()) as {
          items?: CoreTransactionListItem[];
        };
        if (!cancelled) setTransactions(data.items || []);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load entity profit and loss trend:", error);
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
  }, [entityId, sessionToken]);

  useEffect(() => {
    if (currentTab !== "reconciliation" || !sessionToken || !entityId) return;
    let cancelled = false;
    setReconListLoading(true);
    fetch(`/api/entities/${encodeURIComponent(entityId)}/reconciliations`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ReconciliationListItem[]) => {
        if (!cancelled) setReconList(Array.isArray(data) ? data : []);
      })
      .catch(() => { if (!cancelled) setReconList([]); })
      .finally(() => { if (!cancelled) setReconListLoading(false); });
    return () => { cancelled = true; };
  }, [currentTab, sessionToken, entityId]);

  const ownerCopy = useMemo(() => {
    if (!entity) return "";
    if (entity.beneficiaries.length === 1) return "1 shareholder";
    return `${entity.beneficiaries.length} shareholders`;
  }, [entity]);

  const trendItems: ProfitLossTrendItem[] = transactions.map((row) => ({
    id: row.id,
    invoiceDate: row.invoiceDate,
    type: row.type,
    amount: row.grossAmount,
  }));

  if (isLoading) {
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
          <h1>{entity.name}</h1>
          <p>
            {entityTypeLabel(entity.entityType)} · {ownerCopy} ·{" "}
            {properties.length} propert{properties.length === 1 ? "y" : "ies"}
          </p>
        </div>
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
      </header>

      <ProfitLossTrend
        items={trendItems}
        isLoading={trendLoading}
        emptyMessage="No transactions are available for this entity yet."
      />

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

            {properties.length === 0 ? (
              <div className="client-detail-empty">
                <p>No properties have been linked to this entity yet.</p>
              </div>
            ) : (
              <ul className="entity-property-list">
                {properties.map((property) => (
                  <li key={property.id} className="entity-property-row">
                    <div className="entity-property-main">
                      <Link
                        href={`${propertyDetailHrefBase}/${property.id}`}
                        className="entity-property-title-link"
                      >
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
                        <dd>0</dd>
                      </div>
                    </dl>
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
              addTransactionHref={addTransactionHref}
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
              {reconciliationHref && (
                <Link href={reconciliationHref} className="entity-wizard-primary is-green">
                  + Upload Statement
                </Link>
              )}
            </div>
            {reconListLoading ? (
              <div className="client-detail-empty"><p>Loading…</p></div>
            ) : reconList.length === 0 ? (
              <div className="client-detail-empty">
                <p>No bank statements reconciled yet.</p>
                {reconciliationHref && (
                  <Link href={reconciliationHref} className="entity-wizard-primary is-green" style={{ marginTop: 12 }}>
                    Upload your first statement
                  </Link>
                )}
              </div>
            ) : (
              <ul className="entity-property-list">
                {reconList.map((item) => {
                  const txCount = item.summary?.totalTransactions ?? "—";
                  const date = item.createdAt
                    ? new Date(item.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
                    : "—";
                  const statusColor =
                    item.status === "done" ? "var(--color-success, #16a34a)"
                    : item.status === "error" ? "var(--color-danger, #dc2626)"
                    : "var(--color-warning, #ca8a04)";
                  return (
                    <li key={item.id} className="entity-property-row">
                      <div className="entity-property-main">
                        <strong>{date}</strong>
                        <span style={{ color: statusColor, fontWeight: 600, textTransform: "capitalize", fontSize: 13 }}>
                          {item.status}
                        </span>
                      </div>
                      <dl>
                        <div>
                          <dt>Transactions</dt>
                          <dd>{txCount}</dd>
                        </div>
                        <div>
                          <dt>Pages</dt>
                          <dd>{item.totalPages ?? "—"}</dd>
                        </div>
                        <div>
                          <dt>Total Debits</dt>
                          <dd>
                            {item.summary?.totalDebits != null
                              ? `$${item.summary.totalDebits.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`
                              : "—"}
                          </dd>
                        </div>
                      </dl>
                      {reconciliationHref && (
                        <Link
                          href={`${reconciliationHref}?id=${encodeURIComponent(item.id)}`}
                          className="entity-property-chevron-link"
                          aria-label="View reconciliation"
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
            <DocumentVault scope={{ clientId, entityId }} />
          </div>
        )}

        {currentTab !== "properties" && currentTab !== "transactions" && currentTab !== "documents" && currentTab !== "reconciliation" && (
          <div className="entity-coming-soon">
            <strong>{entityTabs.find((tab) => tab.id === currentTab)?.label}</strong>
            <p>Coming soon</p>
          </div>
        )}
      </section>
    </section>
  );
}
