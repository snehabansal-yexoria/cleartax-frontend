"use client";

import Link from "next/link";
import { Skeleton } from "boneyard-js/react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AccountantClientsSkeleton } from "../../../../components/PortalSkeletons";
import { getSession } from "../../../../../src/lib/session";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

interface ClientDetail {
  id: string;
  email: string;
  status: string;
  name: string;
  phoneNumber: string;
  invitedByEmail: string;
  joinedAt: string | null;
  assignedAccountantId: string;
  assignedAccountantName: string;
  isDemo?: boolean;
}

type DetailTab =
  | "entities"
  | "banking"
  | "transactions"
  | "documents";

const demoEntities = [
  {
    id: "rodriguez-family-smsf",
    name: "Rodriguez Family SMSF",
    type: "Self Managed Super Fund",
    ownership: "Micheal Chen 60%",
    properties: 5,
    transactions: 56,
  },
  {
    id: "chen-property-trust",
    name: "Chen Property Trust",
    type: "Discretionary Trust",
    ownership: "Micheal Chen 40%",
    properties: 7,
    transactions: 44,
  },
];

const demoTransactions = [
  ["Mar 1, 2024", "Rent", "Monthly rent - Unit A", "Russian Hill Duplex", "Rodriguez & Associates Holdings", "$8,500"],
  ["Mar 1, 2024", "Rent", "Monthly rent - Unit B", "Russian Hill Duplex", "Rodriguez & Associates Holdings", "$7,800"],
  ["Feb 20, 2024", "Maintenance", "Parking lot resurfacing", "Sunset Business Park", "Rodriguez & Associates Holdings", "$6,200"],
  ["Feb 10, 2024", "Purchase", "Initial purchase", "Russian Hill Duplex", "Rodriguez & Associates Holdings", "$2,450,000"],
];

function getInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

function formatFullDate(value: string | null) {
  if (!value) {
    return "Recently joined";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function AccountantClientDetailPage() {
  const params = useParams<{ clientId: string }>();
  const clientId = String(params?.clientId || "");
  const [isLoading, setIsLoading] = useState(true);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("entities");
  const isDemoClient = client?.isDemo || client?.id === "demo-client-001";

  useEffect(() => {
    async function loadClient() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;

        if (!session || !clientId) {
          return;
        }

        const token = session.getIdToken().getJwtToken();
        const res = await fetch(`/api/users/me/clients/${clientId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          return;
        }

        const data = await res.json();
        setClient(data.client || null);
      } catch (error) {
        console.error("Failed to load client detail:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadClient();
  }, [clientId]);

  const emptyState = useMemo(() => {
    if (activeTab === "banking") {
      return {
        title: "No bank accounts yet",
        description: "Connect or add bank and lending details for this client.",
        button: "Add Bank Account",
      };
    }

    if (activeTab === "transactions") {
      return {
        title: "No transactions yet",
        description: "Transactions will appear here once the first entity and property are created.",
        button: "Add Transaction",
      };
    }

    if (activeTab === "documents") {
      return {
        title: "No documents yet",
        description: "Upload the first document to start building this client's vault.",
        button: "Upload Document",
      };
    }

    return {
      title: "No entities yet",
      description: "Create your first entity to get started",
      button: "Add Entity",
    };
  }, [activeTab]);

  return (
    <Skeleton
      name="accountant-client-detail"
      loading={isLoading}
      fallback={<AccountantClientsSkeleton />}
    >
      <section className="accountant-client-detail-page">
        <Link href="/dashboard/accountant/clients" className="accountant-back-link">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
            <path d="M9 12h10" />
          </svg>
          Back to Clients
        </Link>

        <div className="accountant-client-profile-hero">
          <div className="accountant-client-profile-main">
            <div className="accountant-client-profile-avatar">
              {getInitials(client?.name || "Client")}
            </div>

            <div className="accountant-client-profile-copy">
              <h1>{client?.name || "Client"}</h1>
              <div className="accountant-client-profile-meta">
                <span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 6h16v12H4z" />
                    <path d="m4 7 8 6 8-6" />
                  </svg>
                  {client?.email || "No email"}
                </span>
                <span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M16 3v4" />
                    <path d="M8 3v4" />
                    <path d="M3 11h18" />
                  </svg>
                  Joined {formatFullDate(client?.joinedAt || null)}
                </span>
              </div>
            </div>
          </div>

          <span className="accountant-client-profile-status">
            {String(client?.status || "Pending")
              .replace(/_/g, " ")
              .toLowerCase()
              .replace(/\b\w/g, (letter) => letter.toUpperCase())}
          </span>
        </div>

        <div className="accountant-client-detail-stats">
          <article className="accountant-client-detail-stat">
            <div className="accountant-client-detail-stat-icon is-blue">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 4h8v16H8z" />
                <path d="M4 8h4v12H4z" />
                <path d="M16 10h4v10h-4z" />
              </svg>
            </div>
            <div>
              <span>Total Entities</span>
              <strong>{isDemoClient ? "2" : "0"}</strong>
            </div>
          </article>

          <article className="accountant-client-detail-stat">
            <div className="accountant-client-detail-stat-icon is-gold">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 20V8l8-4 8 4v12" />
                <path d="M9 20v-6h6v6" />
              </svg>
            </div>
            <div>
              <span>Total Properties</span>
              <strong>{isDemoClient ? "12" : "0"}</strong>
            </div>
          </article>

          <article className="accountant-client-detail-stat">
            <div className="accountant-client-detail-stat-icon is-lilac">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v18" />
                <path d="M17 7.5a4 4 0 0 0-4-2.5H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-3a4 4 0 0 1-4-2.5" />
              </svg>
            </div>
            <div>
              <span>Total Transactions</span>
              <strong>{isDemoClient ? "36" : "0"}</strong>
            </div>
          </article>
        </div>

        <div className="accountant-client-detail-panel">
          <div className="accountant-client-detail-tabs">
            <button
              type="button"
              className={activeTab === "entities" ? "is-active" : ""}
              onClick={() => setActiveTab("entities")}
            >
              Entities & Ownership
            </button>
            <button
              type="button"
              className={activeTab === "banking" ? "is-active" : ""}
              onClick={() => setActiveTab("banking")}
            >
              Bank Accounts & Lending
            </button>
            <button
              type="button"
              className={activeTab === "transactions" ? "is-active" : ""}
              onClick={() => setActiveTab("transactions")}
            >
              All Transactions
            </button>
            <button
              type="button"
              className={activeTab === "documents" ? "is-active" : ""}
              onClick={() => setActiveTab("documents")}
            >
              Document Vault
            </button>
          </div>

          {isDemoClient && activeTab === "entities" ? (
            <div className="accountant-client-detail-section">
              <div className="accountant-client-detail-section-head">
                <div>
                  <h2>Entities & Ownership</h2>
                  <p>Review the seeded entities for this demo client.</p>
                </div>
                <Link
                  href={`/dashboard/accountant/clients/${clientId}/entities/new`}
                  className="accountant-primary-cta"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                  Add Entity
                </Link>
              </div>

              <div className="accountant-demo-entity-grid">
                {demoEntities.map((entity) => (
                  <Link
                    key={entity.id}
                    href={`/dashboard/accountant/clients/${clientId}/entities/${entity.id}`}
                    className="accountant-demo-entity-card"
                  >
                    <div>
                      <span>{entity.type}</span>
                      <h3>{entity.name}</h3>
                      <p>{entity.ownership}</p>
                    </div>
                    <div className="accountant-demo-entity-metrics">
                      <strong>{entity.properties} properties</strong>
                      <strong>{entity.transactions} transactions</strong>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : isDemoClient && activeTab === "transactions" ? (
            <div className="accountant-client-detail-section">
              <div className="accountant-client-detail-section-head">
                <div>
                  <h2>All Transactions</h2>
                  <p>Total: <strong>08</strong> transactions</p>
                </div>
                <select aria-label="Filter transactions">
                  <option>All Properties</option>
                </select>
              </div>

              <div className="accountant-demo-transaction-table">
                <div className="accountant-demo-transaction-head">
                  <span>Date</span>
                  <span>Category</span>
                  <span>Description</span>
                  <span>Property</span>
                  <span>Entity</span>
                  <span>Amount</span>
                </div>
                {demoTransactions.map((transaction) => (
                  <div key={`${transaction[0]}-${transaction[2]}`} className="accountant-demo-transaction-row">
                    <span>{transaction[0]}</span>
                    <span><mark>{transaction[1]}</mark></span>
                    <span>{transaction[2]}</span>
                    <span>{transaction[3]}</span>
                    <span>{transaction[4]}</span>
                    <strong>{transaction[5]}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="accountant-client-detail-empty">
              <div className="accountant-client-detail-empty-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 3h7l5 5v13H7z" />
                  <path d="M14 3v5h5" />
                  <path d="M9 13h6" />
                  <path d="M9 17h6" />
                </svg>
              </div>
              <h2>{emptyState.title}</h2>
              <p>{emptyState.description}</p>
              {activeTab === "entities" ? (
                <Link
                  href={`/dashboard/accountant/clients/${clientId}/entities/new`}
                  className="accountant-primary-cta"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                  {emptyState.button}
                </Link>
              ) : (
                <button type="button" className="accountant-primary-cta">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                  {emptyState.button}
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </Skeleton>
  );
}
