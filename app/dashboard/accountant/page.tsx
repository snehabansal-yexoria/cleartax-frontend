"use client";

import { Skeleton } from "boneyard-js/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AccountantDashboardSkeleton } from "../../components/PortalSkeletons";
import { getSession } from "@/src/lib/session";

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
}

interface CurrentUserResponse {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

const pendingStatuses = new Set(["invited", "pending"]);

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

export default function AccountantPage() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [allClients, setAllClients] = useState<ClientRecord[]>([]);
  const [myClients, setMyClients] = useState<ClientRecord[]>([]);
  const [viewMode, setViewMode] = useState<"card" | "list">("list");
  const [selectedAvailableClientId, setSelectedAvailableClientId] =
    useState("");
  const [isAssigningClient, setIsAssigningClient] = useState(false);
  const [assignMessage, setAssignMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) return;

        const token = session.getIdToken().getJwtToken();
        const [meRes, orgRes, allRes, myRes] = await Promise.all([
          fetch("/api/users/me", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/users/me/organization", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/users/me/clients?scope=all", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/users/me/clients?scope=mine", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (meRes.ok) {
          const data = (await meRes.json()) as CurrentUserResponse;
          setCurrentUserEmail(String(data.email || "").toLowerCase());
        }
        if (orgRes.ok) {
          const data = (await orgRes.json()) as OrganizationResponse;
          setOrganizationName(data.organization?.name || "");
        }
        if (allRes.ok) {
          const data = (await allRes.json()) as { clients?: ClientRecord[] };
          setAllClients(data.clients || []);
        }
        if (myRes.ok) {
          const data = (await myRes.json()) as { clients?: ClientRecord[] };
          setMyClients(data.clients || []);
        }
      } catch (error) {
        console.error("Failed to load dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  const invitationPending = useMemo(
    () =>
      allClients.filter((client) => {
        const status = client.status.toLowerCase();
        const invitedByEmail = client.invitedByEmail.toLowerCase();
        return (
          pendingStatuses.has(status) &&
          (!currentUserEmail || invitedByEmail === currentUserEmail)
        );
      }).length,
    [allClients, currentUserEmail],
  );

  const registeredClients = useMemo(
    () =>
      myClients.filter(
        (client) => !pendingStatuses.has(client.status.toLowerCase()),
      ).length,
    [myClients],
  );

  const managedClients = myClients;

  const availableClients = useMemo(
    () =>
      allClients.filter(
        (client) =>
          !client.isAssignedToCurrentAccountant &&
          !client.isAssignedToAnotherAccountant,
      ),
    [allClients],
  );

  const suggestedClients = availableClients.slice(0, 3);

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

  return (
    <Skeleton
      name="accountant-dashboard"
      loading={isLoading}
      fallback={<AccountantDashboardSkeleton />}
    >
      <section className="accountant-dashboard">
        <div className="accountant-summary-grid">
          <article className="accountant-summary-card accountant-summary-card-blue">
            <div>
              <p className="accountant-eyebrow">Invitation Pending</p>
              <h2>{invitationPending}</h2>
              <span>
                {invitationPending === 1
                  ? "Client invited by you still to accept"
                  : "Clients invited by you still to accept"}
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
              <span>{myClients.length} added to your list</span>
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
        </div>

        <div className="accountant-content-grid">
          <section className="accountant-clients-panel">
            <div className="accountant-panel-header">
              <div>
                <h3>Client Management</h3>
                <p>
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

            {managedClients.length === 0 ? (
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
                      <Link href="/dashboard/accountant/clients">Show more</Link>
                    </div>

                    <div className="accountant-suggested-client-list">
                      {suggestedClients.map((client) => {
                        const isSelected =
                          selectedAvailableClientId === client.id;

                        return (
                          <button
                            key={client.id}
                            type="button"
                            className={`accountant-suggested-client${
                              isSelected ? " is-selected" : ""
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
                      <span>{client.phoneNumber || "No phone on file"}</span>
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
    </Skeleton>
  );
}
