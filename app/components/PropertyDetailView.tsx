"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "boneyard-js/react";
import { PropertyDetailSkeleton } from "@/app/components/PortalSkeletons";
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
  const [trendView, setTrendView] = useState<"graph" | "table">("graph");

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
      const amount = Math.abs(row.splitGrossAmount || row.transactionGrossAmount);
      if (row.transactionType === "revenue") current.income += amount;
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
            No transactions are available for this property yet.
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
