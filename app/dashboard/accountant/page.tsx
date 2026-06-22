"use client";

import { Skeleton } from "boneyard-js/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getSession } from "@/src/lib/session";
import { getCurrencyPrefix } from "@/src/lib/currency";
import { fetchReportTimeline } from "./reports/reportsApi";
import type { ReportTimelineEvent } from "./reports/reportsApi";

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

// Activity category styling and icon utilities
const DEMO_ACTIVITIES: ReportTimelineEvent[] = [
  {
    id: "act-1",
    clientId: "client-1",
    clientName: "Sarah Jenkins",
    action: "Invitation Accepted",
    detail: "Sarah Jenkins (sarah.j@example.com) joined as a client.",
    time: "10:30 AM",
    type: "added",
    timestamp: new Date().toISOString(),
  },
  {
    id: "act-2",
    clientId: "client-1",
    clientName: "Sarah Jenkins",
    action: "Document Uploaded",
    detail: "New tax document 'Tax_Return_2025.pdf' uploaded.",
    time: "2:15 PM",
    type: "edited",
    timestamp: new Date().toISOString(),
  },
  {
    id: "act-3",
    clientId: "client-2",
    clientName: "Michael Chang",
    action: "Entity Created",
    detail: "Entity 'Acme Holdings Pty Ltd' created.",
    time: "Yesterday",
    type: "added",
    timestamp: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "act-4",
    clientId: "",
    clientName: "",
    action: "Client Invited",
    detail: "Invitation sent to emily.brown@example.com by Admin.",
    time: "2 days ago",
    type: "edited",
    timestamp: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: "act-5",
    clientId: "client-3",
    clientName: "John Doe",
    action: "Property Updated",
    detail: "Updated estimated market value for '74 Park Road' to $1.2M.",
    time: "3 days ago",
    type: "edited",
    timestamp: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: "act-6",
    clientId: "client-4",
    clientName: "Robert Smith",
    action: "Document Uploaded",
    detail: "Rental Statement for '12 Elm St' uploaded.",
    time: "4 days ago",
    type: "edited",
    timestamp: new Date(Date.now() - 345600000).toISOString(),
  },
  {
    id: "act-7",
    clientId: "client-5",
    clientName: "John Doe",
    action: "Bank Account Linked",
    detail: "ANZ Bank feed connected.",
    time: "5 days ago",
    type: "edited",
    timestamp: new Date(Date.now() - 432000000).toISOString(),
  },
];

function getActivityCategory(action: string, type: ReportTimelineEvent["type"]): "invite" | "document" | "entity" | "property" | "bank" {
  const act = action.toLowerCase();
  if (act.includes("invite") || act.includes("invitation")) return "invite";
  if (act.includes("document") || act.includes("invoice") || act.includes("tax")) return "document";
  if (act.includes("entity") || act.includes("organisation") || act.includes("company")) return "entity";
  if (act.includes("property") || act.includes("portfolio")) return "property";
  if (act.includes("bank") || act.includes("feed") || act.includes("reconcil")) return "bank";
  
  if (type === "added") return "invite";
  if (type === "deleted") return "property";
  return "entity";
}

function getActivityCategoryStyles(category: "invite" | "document" | "entity" | "property" | "bank") {
  switch (category) {
    case "invite":
      return "bg-blue-50 text-blue-600 border border-blue-100/50";
    case "document":
      return "bg-purple-50 text-purple-600 border border-purple-100/50";
    case "entity":
      return "bg-amber-50 text-amber-600 border border-amber-100/50";
    case "property":
      return "bg-emerald-50 text-emerald-600 border border-emerald-100/50";
    case "bank":
      return "bg-cyan-50 text-cyan-600 border border-cyan-100/50";
    default:
      return "bg-slate-50 text-slate-600 border border-slate-100/50";
  }
}

function getActivityIcon(category: "invite" | "document" | "entity" | "property" | "bank") {
  switch (category) {
    case "invite":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      );
    case "document":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "entity":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      );
    case "property":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );
    case "bank":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
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
  // Recent Activity panel: null = loading, [] = loaded-empty, otherwise the
  // accountant's 10 most recent audit-log actions (actor-scoped by the backend).
  const [recentActivity, setRecentActivity] = useState<
    ReportTimelineEvent[] | null
  >(null);

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

  // Recent Activity: the accountant's own latest actions. Reuses the reports
  // timeline endpoint (actor-scoped, newest-first) over a 3-month window and
  // keeps the top 10. fetchReportTimeline handles its own auth via getSession.
  useEffect(() => {
    let cancelled = false;
    fetchReportTimeline("3 months")
      .then((events) => {
        if (!cancelled) setRecentActivity(events.slice(0, 10));
      })
      .catch(() => {
        if (!cancelled) setRecentActivity([]);
      });
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

            {/* <div className="accountant-view-toggle">
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
            </div> */}
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
          <div className="accountant-panel-header" style={{ marginBottom: "12px" }}>
            <div>
              <h3>Recent Activity</h3>
              <p>Latest updates and actions</p>
            </div>
          </div>

          <Skeleton
            name="accountant-recent-activity"
            loading={recentActivity === null}
            fallback={
              <div className="boneyard-fallback flex flex-col gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <div className="skeleton-line skeleton-line-md" />
                    <div className="skeleton-line skeleton-line-sm" />
                  </div>
                ))}
              </div>
            }
          >
            {recentActivity && recentActivity.length > 0 ? (
              <>
                <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[390px] pr-1.5 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                  {recentActivity.map((event) => {
                    const cat = getActivityCategory(event.action, event.type);
                    return (
                      <div
                        key={event.id}
                        className="flex items-start justify-between gap-4 p-3 rounded-2xl hover:bg-slate-50/80 border border-slate-100/50 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-200"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-xl shrink-0 ${getActivityCategoryStyles(cat)}`}>
                            {getActivityIcon(cat)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-slate-800 leading-snug mb-0.5">
                              {event.action}
                              {event.clientName && event.clientId ? (
                                <>
                                  {" — "}
                                  <Link
                                    href={`/dashboard/accountant/reports/clients/${event.clientId}`}
                                    className="font-bold text-[#28336e] hover:underline"
                                  >
                                    {event.clientName}
                                  </Link>
                                </>
                              ) : null}
                            </h4>
                            {event.detail ? (
                              <p className="text-[11px] text-slate-500 leading-normal m-0 font-normal truncate">
                                {event.detail}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0 text-right min-w-[56px] mt-0.5">
                          <span className="text-[10px] font-semibold text-slate-600 leading-none">
                            {event.time}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Link
                  href="/dashboard/accountant/reports"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#28336e] hover:underline self-start"
                >
                  View all reports
                  <svg className="w-3.5 h-3.5 stroke-current stroke-[2] fill-none" viewBox="0 0 24 24">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </Link>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[390px] pr-1.5 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                  {DEMO_ACTIVITIES.map((activity) => {
                    const cat = getActivityCategory(activity.action, activity.type);
                    return (
                      <div
                        key={activity.id}
                        className="flex items-start justify-between gap-4 p-3 rounded-2xl hover:bg-slate-50/80 border border-slate-100/50 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-200"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-xl shrink-0 ${getActivityCategoryStyles(cat)}`}>
                            {getActivityIcon(cat)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-slate-800 leading-snug mb-0.5">
                              {activity.action}
                              {activity.clientName && activity.clientId ? (
                                <>
                                  {" — "}
                                  <span className="font-bold text-[#28336e]">
                                    {activity.clientName}
                                  </span>
                                </>
                              ) : null}
                            </h4>
                            {activity.detail ? (
                              <p className="text-[11px] text-slate-500 leading-normal m-0 font-normal truncate">
                                {activity.detail}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0 text-right min-w-[56px] mt-0.5">
                          <span className="text-[10px] font-semibold text-slate-600 leading-none">
                            {activity.time}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 text-[10px] text-slate-400 font-semibold italic text-center w-full">
                  Showing demo activity data
                </div>
              </>
            )}
          </Skeleton>
        </aside>
      </div>
    </section>
  );
}
