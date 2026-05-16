"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "boneyard-js/react";
import { ClientPortfolioSkeleton } from "@/app/components/PortalSkeletons";
import { AllTransactionsView } from "@/app/components/TransactionsFeature";
import { getSession } from "@/src/lib/session";
import type { CoreEntity, CoreProperty } from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

interface ClientRecord {
  id: string;
  email: string;
  status: string;
  name: string;
  phoneNumber: string;
  invitedByEmail: string;
  joinedAt: string | null;
}

type ClientTab = "entities" | "banking" | "transactions" | "documents";

const clientTabs: { id: ClientTab; label: string }[] = [
  { id: "entities", label: "Entities & Ownership" },
  { id: "banking", label: "Bank Accounts & Lending" },
  { id: "transactions", label: "All Transactions" },
  { id: "documents", label: "Document Vault" },
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

function getInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatJoinedDate(value: string | null) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function statusClass(status: string) {
  return status.toLowerCase() === "active" ? "is-active" : "is-pending";
}

function propertyCountLabel(count: number | undefined) {
  if (count === undefined) return "…";
  return `${count} ${count === 1 ? "Property" : "Properties"}`;
}

export default function ClientDetailPage() {
  const params = useParams<{ clientId: string }>();
  const router = useRouter();
  const clientId = params?.clientId ?? "";

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [entities, setEntities] = useState<CoreEntity[]>([]);
  const [propertyCounts, setPropertyCounts] = useState<Record<string, number | undefined>>({});
  const [currentTab, setCurrentTab] = useState<ClientTab>("entities");
  const [isClientLoading, setIsClientLoading] = useState(true);
  const [isEntitiesLoading, setIsEntitiesLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

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
        const headers = { Authorization: `Bearer ${token}` };

        // Fire client verification and entities fetch in parallel
        const [clientsRes, entitiesRes] = await Promise.all([
          fetch("/api/users/me/clients?scope=mine", { headers }),
          fetch(`/api/entities?client_id=${encodeURIComponent(clientId)}`, { headers }),
        ]);

        if (cancelled) return;

        let canLoadEntities = false;
        if (clientsRes.ok) {
          const data = (await clientsRes.json()) as { clients: ClientRecord[] };
          const match = (data.clients || []).find((c) => c.id === clientId) ?? null;
          if (!cancelled) setClient(match);
          canLoadEntities = Boolean(match);
          if (!match && !cancelled) {
            setLoadError("Add this client to My Clients before opening their portfolio.");
          }
        } else {
          if (!cancelled) setLoadError("Failed to load client.");
        }

        // Reveal client header regardless of whether entities can load
        if (!cancelled) setIsClientLoading(false);

        if (!canLoadEntities || cancelled) {
          if (!cancelled) setIsEntitiesLoading(false);
          return;
        }

        if (entitiesRes.ok) {
          const data = (await entitiesRes.json()) as { items: CoreEntity[] };
          const loadedEntities = data.items || [];
          if (!cancelled) {
            setEntities(loadedEntities);
            setIsEntitiesLoading(false); // Show entity cards immediately

            // Fire one property count fetch per entity independently — no await
            for (const entity of loadedEntities) {
              fetch(`/api/entities/${encodeURIComponent(entity.id)}/properties`, { headers })
                .then((res) => (res.ok ? res.json() : { items: [] }))
                .then((payload: { items?: CoreProperty[] }) => {
                  if (!cancelled) {
                    setPropertyCounts((prev) => ({
                      ...prev,
                      [entity.id]: payload.items?.length ?? 0,
                    }));
                  }
                })
                .catch(() => {
                  if (!cancelled) {
                    setPropertyCounts((prev) => ({ ...prev, [entity.id]: 0 }));
                  }
                });
            }
          }
        } else {
          if (!cancelled) setIsEntitiesLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load client detail:", error);
          setLoadError("Unexpected error loading client.");
          setIsClientLoading(false);
          setIsEntitiesLoading(false);
        }
      }
    }

    if (clientId) load();
    return () => {
      cancelled = true;
    };
  }, [clientId, router]);

  const totalProperties = useMemo(
    () => Object.values(propertyCounts).reduce<number>((sum, count) => sum + (count ?? 0), 0),
    [propertyCounts],
  );

  if (isClientLoading) {
    return (
      <Skeleton
        name="client-portfolio-page"
        loading
        fallback={<ClientPortfolioSkeleton />}
      >
        <ClientPortfolioSkeleton />
      </Skeleton>
    );
  }

  if (!client) {
    return (
      <section className="client-detail-page client-portfolio-page">
        <Link href="/dashboard/accountant/clients" className="entity-wizard-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back to Clients
        </Link>
        <p className="entity-wizard-error">{loadError || "Client not found."}</p>
      </section>
    );
  }

  return (
    <section className="client-detail-page client-portfolio-page">
      <Link href="/dashboard/accountant/clients" className="entity-wizard-back">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Back to Clients
      </Link>

      <header className="client-profile-card">
        <div className="client-profile-main">
          <span className="client-profile-avatar">{getInitials(client.name)}</span>
          <div>
            <h1>{client.name}</h1>
            <div className="client-profile-meta">
              <span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 6h16v12H4z" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
                {client.email}
              </span>
              <span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="4" y="5" width="16" height="15" rx="2" />
                  <path d="M8 3v4" />
                  <path d="M16 3v4" />
                  <path d="M4 10h16" />
                </svg>
                Joined {formatJoinedDate(client.joinedAt)}
              </span>
            </div>
          </div>
        </div>
        <span className={`client-status-pill ${statusClass(client.status)}`}>
          {titleCase(client.status)}
        </span>
      </header>

      <div className="client-stat-grid">
        <article className="client-stat-card">
          <span className="client-stat-icon is-entity">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
              <path d="M9 8h6" />
              <path d="M9 12h6" />
              <path d="M9 16h6" />
            </svg>
          </span>
          <div>
            <span>Total Entities</span>
            <strong>{isEntitiesLoading ? "—" : entities.length}</strong>
          </div>
        </article>
        <article className="client-stat-card">
          <span className="client-stat-icon is-property">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 21V9l8-6 8 6v12" />
              <path d="M9 21v-7h6v7" />
              <path d="M9 10h.01" />
              <path d="M15 10h.01" />
            </svg>
          </span>
          <div>
            <span>Total Properties</span>
            <strong>{isEntitiesLoading ? "—" : totalProperties}</strong>
          </div>
        </article>
        <article className="client-stat-card">
          <span className="client-stat-icon is-transaction">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2v20" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </span>
          <div>
            <span>Total Transactions</span>
            <strong>0</strong>
          </div>
        </article>
      </div>

      <section className="client-portfolio-panel">
        <div className="client-portfolio-tabs" role="tablist" aria-label="Client detail sections">
          {clientTabs.map((tab) => (
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

        {currentTab === "entities" && (
          <div className="client-portfolio-tab-body">
            {isEntitiesLoading ? (
              <div className="client-empty-entities">
                <p>Loading entities…</p>
              </div>
            ) : entities.length === 0 ? (
              <div className="client-empty-entities">
                <span className="client-empty-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
                    <path d="M9 8h6" />
                    <path d="M9 12h6" />
                    <path d="M9 16h6" />
                  </svg>
                </span>
                <strong>No entities yet</strong>
                <p>Create your first entity to get started</p>
                <Link
                  href={`/dashboard/accountant/clients/${clientId}/entities/new`}
                  className="entity-wizard-primary"
                >
                  + Add Entity
                </Link>
              </div>
            ) : (
              <>
                <div className="client-portfolio-section-head">
                  <h2>Entities & Ownership</h2>
                  <Link
                    href={`/dashboard/accountant/clients/${clientId}/entities/new`}
                    className="entity-wizard-primary"
                  >
                    + Add Entity
                  </Link>
                </div>

                <div className="entity-card-grid">
                  {entities.map((entity) => {
                    const propertyCount = propertyCounts[entity.id];
                    return (
                      <article key={entity.id} className="entity-ownership-card">
                        <Link
                          href={`/dashboard/accountant/clients/${clientId}/entities/${entity.id}`}
                          className="entity-ownership-card-main"
                        >
                          <div className="entity-ownership-card-top">
                            <span className="entity-card-icon">
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
                                <path d="M9 8h6" />
                                <path d="M9 12h6" />
                                <path d="M9 16h6" />
                              </svg>
                            </span>
                            <span className="entity-type-badge">
                              {entityTypeLabel(entity.entityType)}
                            </span>
                          </div>

                          <h3>{entity.name}</h3>
                          <strong className="entity-ownership-label">
                            Ownership
                          </strong>
                          <ul className="entity-card-owners">
                            {entity.beneficiaries.map((beneficiary) => (
                              <li key={beneficiary.id ?? beneficiary.name}>
                                <span>{beneficiary.name}</span>
                                <strong>{beneficiary.ownershipPercentage}%</strong>
                              </li>
                            ))}
                          </ul>

                          <div className="entity-card-footer-line">
                            <span>{propertyCountLabel(propertyCount)}</span>
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="m9 6 6 6-6 6" />
                            </svg>
                          </div>
                        </Link>

                        <Link
                          href={`/dashboard/accountant/clients/${clientId}/entities/${entity.id}/edit`}
                          className="entity-card-edit-action"
                          aria-label={`Edit ${entity.name}`}
                          title="Edit entity"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </Link>

                        <Link
                          href={`/dashboard/accountant/clients/${clientId}/entities/${entity.id}/properties/new`}
                          className="entity-card-add-property"
                        >
                          + Add Property
                        </Link>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {currentTab === "transactions" && (
          <div className="client-portfolio-tab-body">
            <AllTransactionsView
              context={{ kind: "client", clientId }}
              addTransactionHref={
                entities[0]
                  ? `/dashboard/accountant/clients/${clientId}/entities/${entities[0].id}/transactions/new`
                  : "/dashboard/accountant/transactions/new"
              }
              compact
            />
          </div>
        )}

        {currentTab !== "entities" && currentTab !== "transactions" && (
          <div className="client-coming-soon">
            <strong>{clientTabs.find((tab) => tab.id === currentTab)?.label}</strong>
            <p>Coming soon</p>
          </div>
        )}
      </section>
    </section>
  );
}
