"use client";

import { Skeleton } from "boneyard-js/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getSession } from "@/src/lib/session";
import { getCurrencyPrefix } from "@/src/lib/currency";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

interface OrganizationResponse {
  organization: {
    id: string;
    name: string;
  } | null;
}

interface ClientRecord {
  id: string;
  email: string;
  status: string;
  name: string;
  phoneNumber: string;
  invitedByEmail: string;
  joinedAt: string | null;
  assignedAccountantId?: string;
  assignedAccountantName?: string;
  isAssignedToCurrentAccountant?: boolean;
  isAssignedToAnotherAccountant?: boolean;
  propertiesCount?: number;
  totalMarketValue?: number;
}

interface DashboardSummary {
  pendingInvitations: number;
  registeredClients: number;
  managedClients: number;
  totalProperties: number;
  totalMarketValue: number;
}

function getInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "CL";
}

function formatJoinedDate(value: string | null) {
  if (!value) return "Recently";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  const formatted = new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
  return `${getCurrencyPrefix()}${value < 0 ? "-" : ""}${formatted}`;
}

export default function AccountantPage() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [myClients, setMyClients] = useState<ClientRecord[] | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  // Unassigned clients for the "add to my list" nudge — loaded lazily only when
  // the empty state is shown, so the dashboard never queries all clients on load.
  const [availableClients, setAvailableClients] = useState<ClientRecord[] | null>(null);
  const [viewMode, setViewMode] = useState<"card" | "list">("list");
  const [selectedAvailableClientId, setSelectedAvailableClientId] =
    useState("");
  const [isAssigningClient, setIsAssigningClient] = useState(false);
  const [assignMessage, setAssignMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    getSession().then((rawSession) => {
      const session = rawSession as SessionWithIdToken | null;
      if (!session || cancelled) return;

      const token = session.getIdToken().getJwtToken();
      const headers = { Authorization: `Bearer ${token}` };

      fetch("/api/users/me/organization", { headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: OrganizationResponse | null) => {
          if (!cancelled) setOrganizationName(data?.organization?.name || "");
        })
        .catch(() => { if (!cancelled) setOrganizationName(""); });

      // Stat-card numbers come from the summary endpoint (aggregates only — no
      // client list). pending_invitations is org-wide; the rest are my counts.
      fetch("/api/users/me/accountant-summary", { headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: DashboardSummary | null) => {
          if (cancelled) return;
          setSummary(
            data ?? {
              pendingInvitations: 0,
              registeredClients: 0,
              managedClients: 0,
              totalProperties: 0,
              totalMarketValue: 0,
            },
          );
        })
        .catch(() => {
          if (!cancelled)
            setSummary({
              pendingInvitations: 0,
              registeredClients: 0,
              managedClients: 0,
              totalProperties: 0,
              totalMarketValue: 0,
            });
        });

      // Client Management list = my clients only.
      fetch("/api/users/me/clients?scope=mine", { headers })
        .then((res) => (res.ok ? res.json() : { clients: [] }))
        .then((data: { clients?: ClientRecord[] }) => {
          if (!cancelled) setMyClients(data.clients || []);
        })
        .catch(() => { if (!cancelled) setMyClients([]); });
    }).catch(() => { });

    return () => { cancelled = true; };
  }, []);

  const invitationPending = summary?.pendingInvitations ?? 0;
  const registeredClients = summary?.registeredClients ?? 0;
  const managedClients = myClients ?? [];
  const suggestedClients = (availableClients ?? []).slice(0, 3);

  // Stat-card totals, in the shape the cards already read.
  const summaryStats = summary
    ? {
      totalProperties: summary.totalProperties,
      totalMarketValue: summary.totalMarketValue,
    }
    : null;

  // Lazily load unassigned clients for the "add to my list" nudge — only when
  // the empty state is on screen, never on the normal (has-clients) dashboard.
  const loadAvailableClients = useCallback(async () => {
    if (availableClients !== null) return;
    try {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) return;
      const token = session.getIdToken().getJwtToken();
      const res = await fetch("/api/users/me/clients?scope=all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const clients = (res.ok ? (await res.json()).clients : []) as ClientRecord[];
      setAvailableClients(
        clients.filter(
          (c) =>
            !c.isAssignedToCurrentAccountant && !c.isAssignedToAnotherAccountant,
        ),
      );
    } catch {
      setAvailableClients([]);
    }
  }, [availableClients]);

  useEffect(() => {
    if (myClients !== null && managedClients.length === 0) {
      void loadAvailableClients();
    }
  }, [myClients, managedClients.length, loadAvailableClients]);

  async function handleAssignSuggestedClient() {
    if (!selectedAvailableClientId || isAssigningClient) {
      return;
    }

    try {
      setIsAssigningClient(true);
      setAssignMessage("");

      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) {
        setAssignMessage("Your session has expired. Please log in again.");
        return;
      }

      const token = session.getIdToken().getJwtToken();
      const res = await fetch("/api/users/me/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clientIds: [selectedAvailableClientId] }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setAssignMessage(data.error || "Failed to add this client.");
        return;
      }

      router.push("/dashboard/accountant/clients?tab=mine");
    } catch (error) {
      console.error("Assign suggested client error:", error);
      setAssignMessage("Something went wrong while adding this client.");
    } finally {
      setIsAssigningClient(false);
    }
  }

  const summaryLoading = summary === null || myClients === null;

  return (
    <section className="accountant-dashboard">
      <Skeleton
        name="accountant-summary"
        loading={summaryLoading}
        fallback={
          <div className="accountant-summary-grid boneyard-fallback">
            <article className="accountant-summary-card accountant-summary-card-blue">
              <div className="skeleton-line skeleton-line-sm" />
              <div className="skeleton-line skeleton-line-xl" />
              <div className="skeleton-line skeleton-line-md" />
            </article>
            <article className="accountant-summary-card accountant-summary-card-gold">
              <div className="skeleton-line skeleton-line-sm" />
              <div className="skeleton-line skeleton-line-xl" />
              <div className="skeleton-circle" />
            </article>
            <article className="accountant-summary-card accountant-summary-card-purple">
              <div className="skeleton-line skeleton-line-sm" />
              <div className="skeleton-line skeleton-line-xl" />
              <div className="skeleton-circle" />
            </article>
            <article className="accountant-summary-card accountant-summary-card-green">
              <div className="skeleton-line skeleton-line-sm" />
              <div className="skeleton-line skeleton-line-xl" />
              <div className="skeleton-circle" />
            </article>
          </div>
        }
      >
        <div className="accountant-summary-grid">
          <article className="accountant-summary-card accountant-summary-card-blue">
            <div>
              <p className="accountant-eyebrow">Invitation Pending</p>
              <h2>{invitationPending}</h2>
              <span>
                {invitationPending === 1
                  ? "Client still to accept"
                  : "Clients still to accept"}
              </span>
            </div>
            <Link
              href="/dashboard/accountant/clients?invite=1"
              className="accountant-primary-cta accountant-summary-cta"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              Invite Client
            </Link>
          </article>

          <article className="accountant-summary-card accountant-summary-card-gold">
            <div>
              <p className="accountant-eyebrow">Registered Clients</p>
              <h2>{registeredClients}</h2>
              <span>{managedClients.length} added to your list</span>
            </div>
            <div className="accountant-summary-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
                <circle cx="9.5" cy="7" r="4" />
                <path d="M20 19v-1.2a3.4 3.4 0 0 0-2.7-3.3" />
                <path d="M15.8 4.8a3.6 3.6 0 0 1 0 6.9" />
              </svg>
            </div>
          </article>

          <article className="accountant-summary-card accountant-summary-card-purple">
            <div>
              <p className="accountant-eyebrow">Properties Managed</p>
              <h2>{summaryStats?.totalProperties ?? 0}</h2>
              <span>Across client portfolios</span>
            </div>
            <div className="accountant-summary-icon accountant-summary-icon-purple">
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
          </article>

          <article className="accountant-summary-card accountant-summary-card-green">
            <div>
              <p className="accountant-eyebrow">Total Market Value</p>
              <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.4rem)", marginTop: "4px", marginBottom: "4px" }}>
                {formatCurrency(summaryStats?.totalMarketValue ?? 0)}
              </h2>
              <span>Estimated asset valuation</span>
            </div>
            <div className="accountant-summary-icon accountant-summary-icon-green">
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
          </article>
        </div>
      </Skeleton>

      <div className="accountant-content-grid">
        <section className={`accountant-clients-panel${!summaryLoading && registeredClients === 0 ? " is-inactive" : ""}`}>
          <div className="accountant-panel-header">
            <div>
              <h3 style={!summaryLoading && registeredClients === 0 ? { color: "#64748b", transition: "color 0.3s ease" } : undefined}>Client Management</h3>
              <p style={!summaryLoading && registeredClients === 0 ? { color: "#94a3b8", transition: "color 0.3s ease" } : undefined}>
                {managedClients.length > 0
                  ? organizationName
                    ? `Manage your clients for ${organizationName}`
                    : "Manage your portfolio clients"
                  : "Add clients to your list to start managing their portfolios"}
              </p>
            </div>

            <div className="accountant-view-toggle">
              <button
                type="button"
                className={viewMode === "card" ? "is-active" : ""}
                onClick={() => setViewMode("card")}
                disabled={!summaryLoading && registeredClients === 0}
                style={{
                  ...(!summaryLoading && registeredClients === 0 && {
                    opacity: 0.5,
                    cursor: "not-allowed",
                    pointerEvents: "none",
                  }),
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="4" width="7" height="7" rx="1.2" />
                  <rect x="14" y="4" width="7" height="7" rx="1.2" />
                  <rect x="3" y="13" width="7" height="7" rx="1.2" />
                  <rect x="14" y="13" width="7" height="7" rx="1.2" />
                </svg>
                Card View
              </button>
              <button
                type="button"
                className={viewMode === "list" ? "is-active" : ""}
                onClick={() => setViewMode("list")}
                disabled={!summaryLoading && registeredClients === 0}
                style={{
                  ...(!summaryLoading && registeredClients === 0 && {
                    opacity: 0.5,
                    cursor: "not-allowed",
                    pointerEvents: "none",
                  }),
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 6h13" />
                  <path d="M8 12h13" />
                  <path d="M8 18h13" />
                  <circle cx="4" cy="6" r="1" />
                  <circle cx="4" cy="12" r="1" />
                  <circle cx="4" cy="18" r="1" />
                </svg>
                List View
              </button>
            </div>
          </div>

          <div className="accountant-panel-content-wrapper" style={{ position: "relative", minHeight: "250px" }}>
            {!summaryLoading && registeredClients === 0 && (
              <div
                className="accountant-panel-inactive-overlay"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(255, 255, 255, 0.75)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 10,
                  borderRadius: "18px",
                  animation: "accountantFadeIn 0.3s ease-in-out",
                }}
              >
                <div
                  className="accountant-panel-inactive-content"
                  style={{
                    textAlign: "center",
                    padding: "24px",
                    maxWidth: "340px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "16px",
                  }}
                >
                  <div
                    className="accountant-panel-inactive-icon"
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "999px",
                      background: "#f8fafc",
                      color: "#64748b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      style={{
                        width: "24px",
                        height: "24px",
                        stroke: "currentColor",
                        strokeWidth: 2,
                        fill: "none",
                      }}
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <h4
                    style={{
                      fontSize: "1.25rem",
                      color: "#0f172a",
                      fontWeight: 700,
                      margin: 0,
                    }}
                  >
                    Client Management Inactive
                  </h4>
                  <p
                    style={{
                      fontSize: "0.95rem",
                      color: "#475569",
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    You have 0 registered clients. Please register or add a client to activate client management.
                  </p>
                  <Link
                    href="/dashboard/accountant/clients"
                    className="accountant-primary-cta"
                    style={{
                      marginTop: "4px",
                      padding: "10px 20px",
                      fontSize: "0.9rem",
                      boxShadow: "0 4px 12px rgba(47, 59, 130, 0.15)",
                    }}
                  >
                    Go to Clients
                  </Link>
                </div>
              </div>
            )}

            {myClients === null ? (
              <div className="accountant-client-grid boneyard-fallback">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton-panel skeleton-panel-tall" />
                ))}
              </div>
            ) : managedClients.length === 0 ? (
              <div className="accountant-empty-state">
                <p>You have not added any clients to your list yet.</p>
                <Link
                  href="/dashboard/accountant/clients"
                  className="accountant-empty-cta"
                >
                  Start adding clients to your list
                </Link>
                {suggestedClients.length > 0 && (
                  <div className="accountant-suggested-clients">
                    <div className="accountant-suggested-clients-head">
                      <div>
                        <strong>Available clients</strong>
                        <span>Pick one to add directly to My Clients.</span>
                      </div>
                      <Link href="/dashboard/accountant/clients">
                        Show more
                      </Link>
                    </div>

                    <div className="accountant-suggested-client-list">
                      {suggestedClients.map((client) => {
                        const isSelected =
                          selectedAvailableClientId === client.id;

                        return (
                          <button
                            key={client.id}
                            type="button"
                            className={`accountant-suggested-client${isSelected ? " is-selected" : ""
                              }`}
                            onClick={() => {
                              setAssignMessage("");
                              setSelectedAvailableClientId((current) =>
                                current === client.id ? "" : client.id,
                              );
                            }}
                          >
                            <span className="accountant-client-pill">
                              {getInitials(client.name)}
                            </span>
                            <span className="accountant-suggested-client-copy">
                              <strong>{client.name}</strong>
                              <span>{client.email}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {selectedAvailableClientId && (
                      <button
                        type="button"
                        className="accountant-suggested-add"
                        onClick={handleAssignSuggestedClient}
                        disabled={isAssigningClient}
                      >
                        {isAssigningClient ? "Adding..." : "Add to list"}
                      </button>
                    )}

                    {assignMessage && (
                      <p className="accountant-suggested-message">
                        {assignMessage}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : viewMode === "card" ? (
              <div className="accountant-client-grid">
                {managedClients.map((client) => (
                  <Link
                    key={client.id}
                    href={`/dashboard/accountant/clients/${client.id}`}
                    className="accountant-client-card accountant-client-card-plain"
                  >
                    <div className="accountant-client-pill">
                      {getInitials(client.name)}
                    </div>
                    <div className="accountant-client-copy">
                      <h4>{client.name}</h4>
                      <p>{client.email}</p>
                      <span>{client.phoneNumber || ""}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="accountant-client-list">
                {managedClients.map((client) => (
                  <Link
                    key={client.id}
                    href={`/dashboard/accountant/clients/${client.id}`}
                    className="accountant-client-list-row"
                  >
                    <div className="accountant-client-list-main">
                      <div className="accountant-client-pill">
                        {getInitials(client.name)}
                      </div>
                      <div className="accountant-client-list-copy">
                        <h4>{client.name}</h4>
                        <p>{client.email}</p>
                      </div>
                    </div>

                    <div className="accountant-client-list-meta">
                      <span className="accountant-client-list-label">
                        Status
                      </span>
                      <strong>{client.status || "Active"}</strong>
                    </div>

                    <div className="accountant-client-list-meta">
                      <span className="accountant-client-list-label">
                        Joined
                      </span>
                      <strong>{formatJoinedDate(client.joinedAt)}</strong>
                    </div>

                    <div className="accountant-client-list-meta">
                      <span className="accountant-client-list-label">
                        Invited by
                      </span>
                      <strong>
                        {client.invitedByEmail || "Organisation Admin"}
                      </strong>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="accountant-activity-panel">
          <div className="accountant-panel-header">
            <div>
              <h3>Recent Activity</h3>
              <p>Latest updates and actions</p>
            </div>
          </div>

          <div className="accountant-empty-state">
            <p>
              No activity feed yet. Once we wire up the activity stream this
              is where new documents, invites and entity changes will land.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
