"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
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
          if (!cancelled) setEntity(data);
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
                {properties.map((property) => (
                  <li key={property.id} className="entity-property-row">
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
