"use client";

import { Skeleton } from "boneyard-js/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountantDashboardSkeleton } from "../../components/PortalSkeletons";
import { getSession } from "../../../src/lib/session";

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

const summaryCards = [
  {
    title: "Invitation Pending",
    value: "24",
    change: "+12% from last month",
    tone: "blue",
    actionLabel: "Invite Client",
    actionHref: "/dashboard/accountant/clients?invite=1",
  },
  {
    title: "Registered Clients",
    value: "186",
    change: "+08% from last month",
    tone: "gold",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
        <circle cx="9.5" cy="7" r="4" />
        <path d="M20 19v-1.2a3.4 3.4 0 0 0-2.7-3.3" />
        <path d="M15.8 4.8a3.6 3.6 0 0 1 0 6.9" />
      </svg>
    ),
  },
];

const clients = [
  {
    name: "Michael Chen",
    email: "michael.chen@realestate.com",
    properties: "12 Total Properties",
    image:
      "https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Emily Rodriguez",
    email: "emily.r@propertygroup.io",
    properties: "8 Total Properties",
    image:
      "https://images.unsplash.com/photo-1605146769289-440113cc3d00?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Charles Brown",
    email: "charles.b87@gmail.com",
    properties: "24 Total Properties",
    image:
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Jennifer Martinez",
    email: "j.martinez@homesinvest.net",
    properties: "6 Total Properties",
    image:
      "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Robert Thompson",
    email: "rthompson@urbanrealty.com",
    properties: "10 Total Properties",
    image:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Lucy Jackson",
    email: "jackson.lucy@gmail.com",
    properties: "8 Total Properties",
    image:
      "https://images.unsplash.com/photo-1448630360428-65456885c650?auto=format&fit=crop&w=900&q=80",
  },
];

const activities = [
  {
    day: "Today",
    items: [
      {
        title: "Document Upload",
        client: "Client #MC-2847",
        time: "2 mins ago",
        tone: "navy",
      },
      {
        title: "Bank Connected",
        client: "Client #ER-1523",
        time: "15 mins ago",
        tone: "gold",
      },
      {
        title: "Task Completed",
        client: "Client #DP-9241",
        time: "1 hour ago",
        tone: "green",
      },
    ],
  },
  {
    day: "Yesterday",
    items: [
      {
        title: "New Client Added",
        client: "Client #JM-4762",
        time: "2 hours ago",
        tone: "violet",
      },
      {
        title: "Statement Uploaded",
        client: "Client #RT-3156",
        time: "3 hours ago",
        tone: "navy",
      },
    ],
  },
];

export default function AccountantPage() {
  const [organizationName, setOrganizationName] = useState("");
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadOrganization() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;

        if (!session) {
          return;
        }

        const token = session.getIdToken().getJwtToken();

        const res = await fetch("/api/users/me/organization", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as OrganizationResponse;
        setOrganizationName(data.organization?.name || "");
      } catch (error) {
        console.error("Failed to load organization:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadOrganization();
  }, []);

  return (
    <Skeleton
      name="accountant-dashboard"
      loading={isLoading}
      fallback={<AccountantDashboardSkeleton />}
    >
      <section className="accountant-dashboard">
        <div className="accountant-summary-grid">
          {summaryCards.map((card) => (
            <article
              key={card.title}
              className={`accountant-summary-card accountant-summary-card-${card.tone}`}
            >
              <div>
                <p className="accountant-eyebrow">{card.title}</p>
                <h2>{card.value}</h2>
                <span>{card.change}</span>
              </div>

              {card.actionHref ? (
                <Link href={card.actionHref} className="accountant-primary-cta">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                  {card.actionLabel}
                </Link>
              ) : (
                <div className="accountant-summary-icon">{card.icon}</div>
              )}
            </article>
          ))}
        </div>

        <div className="accountant-content-grid">
          <section className="accountant-clients-panel">
            <div className="accountant-panel-header">
              <div>
                <h3>Client Management</h3>
                <p>
                  {organizationName
                    ? `Manage clients for ${organizationName}`
                    : "Manage your portfolio clients"}
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

            {viewMode === "card" ? (
              <div className="accountant-client-grid">
                {clients.map((client) => (
                  <article
                    key={client.email}
                    className="accountant-client-card"
                    style={{
                      backgroundImage: `linear-gradient(180deg, rgba(11, 17, 44, 0.02) 18%, rgba(11, 17, 44, 0.82) 100%), url(${client.image})`,
                    }}
                  >
                    <div className="accountant-client-copy">
                      <h4>{client.name}</h4>
                      <p>{client.email}</p>
                      <span>{client.properties}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="accountant-client-list">
              {clients.map((client, index) => (
                <article key={client.email} className="accountant-client-list-row">
                  <div className="accountant-client-list-main">
                    <div
                      className="accountant-client-list-image"
                      aria-hidden="true"
                      style={{ backgroundImage: `url(${client.image})` }}
                    />
                    <div className="accountant-client-list-copy">
                      <h4>{client.name}</h4>
                      <p>{client.email}</p>
                    </div>
                  </div>

                  <div className="accountant-client-list-meta">
                    <span className="accountant-client-list-label">Portfolio</span>
                    <strong>{client.properties}</strong>
                  </div>

                  <div className="accountant-client-list-meta">
                    <span className="accountant-client-list-label">Status</span>
                    <strong>{index % 2 === 0 ? "Active" : "Reviewing"}</strong>
                  </div>

                  <div className="accountant-client-list-meta">
                    <span className="accountant-client-list-label">Last Update</span>
                    <strong>{index + 1}h ago</strong>
                  </div>
                </article>
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

          <div className="accountant-activity-list">
            {activities.map((group) => (
              <div key={group.day} className="accountant-activity-group">
                <span className="accountant-activity-day">{group.day}</span>

                {group.items.map((item) => (
                  <div key={`${group.day}-${item.title}`} className="accountant-activity-item">
                    <div className={`accountant-activity-icon tone-${item.tone}`}>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="3.5" />
                        <path d="M12 4v3" />
                        <path d="M12 17v3" />
                        <path d="M4 12h3" />
                        <path d="M17 12h3" />
                      </svg>
                    </div>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.client}</p>
                      <span>{item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <button type="button" className="accountant-secondary-cta">
            View All Activity
          </button>
          </aside>
        </div>
      </section>
    </Skeleton>
  );
}
