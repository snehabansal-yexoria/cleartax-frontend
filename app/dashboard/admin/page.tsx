"use client";

import { Skeleton } from "boneyard-js/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PortalDashboardSkeleton } from "../../components/PortalSkeletons";
import { getSession } from "../../../src/lib/session";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

interface InvitedUser {
  id: string;
  email: string;
  role: string;
  status: string;
  name: string;
  organizationName: string;
  invitedByEmail: string;
  createdAt: string | null;
}

interface InvitedUsersResponse {
  summary: {
    total: number;
    pending: number;
    admins: number;
    accountants: number;
    clients: number;
    organizations: number;
  };
  users: InvitedUser[];
}

export default function AdminPage() {
  const [organizationName, setOrganizationName] = useState("");
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const accountantCount = useMemo(
    () => invitedUsers.filter((user) => user.role === "accountant").length,
    [invitedUsers],
  );

  const clientCount = useMemo(
    () => invitedUsers.filter((user) => user.role === "client").length,
    [invitedUsers],
  );

  useEffect(() => {
    async function loadAdminDashboard() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;

        if (!session) {
          return;
        }

        const token = session.getIdToken().getJwtToken();

        const [orgRes, invitedRes] = await Promise.all([
          fetch("/api/users/me/organization", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/users/me/invited", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        if (orgRes.ok) {
          const data = await orgRes.json();
          setOrganizationName(data.organization?.name || "");
        }

        if (invitedRes.ok) {
          const data = (await invitedRes.json()) as InvitedUsersResponse;
          setInvitedUsers(data.users || []);
          setPendingCount(data.summary?.pending || 0);
        }
      } catch (error) {
        console.error("Failed to load admin dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadAdminDashboard();
  }, []);

  return (
    <Skeleton
      name="admin-dashboard"
      loading={isLoading}
      fallback={<PortalDashboardSkeleton />}
    >
      <section className="portal-page">
      <div className="portal-page-header">
        <div>
          <p className="portal-kicker">Admin Workspace</p>
          <h1>{organizationName || "Organization Overview"}</h1>
          <p>Manage your invited users and track onboarding progress.</p>
        </div>

        <Link href="/dashboard/admin/invite" className="portal-primary-link">
          Invite User
        </Link>
      </div>

      <div className="portal-summary-grid">
        <article className="portal-summary-card portal-summary-card-blue">
          <span>Pending Invites</span>
          <strong>{pendingCount}</strong>
          <p>Users who still need to activate their account.</p>
        </article>
        <article className="portal-summary-card portal-summary-card-gold">
          <span>Accountants</span>
          <strong>{accountantCount}</strong>
          <p>Finance team members active in this organization.</p>
        </article>
        <article className="portal-summary-card">
          <span>Clients</span>
          <strong>{clientCount}</strong>
          <p>All invited clients currently attached to your organization.</p>
        </article>
      </div>

      <div className="portal-list-card">
        <div className="portal-list-header">
          <div>
            <h2>Invited Users</h2>
            <p>Organization-scoped list of accountants and clients.</p>
          </div>
          <span className="portal-list-count">{invitedUsers.length} users</span>
        </div>

        <div className="portal-list-table">
          <div className="portal-list-head">
            <div>Name</div>
            <div>Email</div>
            <div>Role</div>
            <div>Status</div>
          </div>

          {invitedUsers.map((user) => (
            <article key={user.id} className="portal-list-row">
              <div>
                <strong>{user.name}</strong>
              </div>
              <div>{user.email}</div>
              <div>
                <span className="portal-badge">{user.role}</span>
              </div>
              <div>
                <span
                  className={`portal-status${
                    user.status === "INVITED" ? " is-pending" : ""
                  }`}
                >
                  {user.status}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
      </section>
    </Skeleton>
  );
}
