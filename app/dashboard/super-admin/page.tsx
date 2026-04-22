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

export default function SuperAdminPage() {
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);
  const [summary, setSummary] = useState<InvitedUsersResponse["summary"]>({
    total: 0,
    pending: 0,
    admins: 0,
    accountants: 0,
    clients: 0,
    organizations: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const activeOrganizations = useMemo(
    () =>
      new Set(
        invitedUsers.map((user) => user.organizationName).filter(Boolean),
      ).size,
    [invitedUsers],
  );

  useEffect(() => {
    async function loadSuperAdminDashboard() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;

        if (!session) {
          return;
        }

        const token = session.getIdToken().getJwtToken();
        const res = await fetch("/api/users/me/invited", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as InvitedUsersResponse;
        setInvitedUsers(data.users || []);
        setSummary(data.summary);
      } catch (error) {
        console.error("Failed to load super admin dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSuperAdminDashboard();
  }, []);

  return (
    <Skeleton
      name="super-admin-dashboard"
      loading={isLoading}
      fallback={<PortalDashboardSkeleton />}
    >
      <section className="portal-page">
      <div className="portal-page-header">
        <div>
          <p className="portal-kicker">Platform Overview</p>
          <h1>Super Admin Control Center</h1>
          <p>Track admin onboarding, organization coverage, and platform growth.</p>
        </div>

        <div className="portal-header-actions">
          <Link
            href="/dashboard/super-admin/create-organization"
            className="portal-secondary-link"
          >
            Create Organization
          </Link>
          <Link
            href="/dashboard/super-admin/bulk-upload"
            className="portal-secondary-link"
          >
            Bulk Upload
          </Link>
          <Link
            href="/dashboard/super-admin/invite-admin"
            className="portal-primary-link"
          >
            Invite Admin
          </Link>
        </div>
      </div>

      <div className="portal-summary-grid">
        <article className="portal-summary-card portal-summary-card-blue">
          <span>Admin Invites</span>
          <strong>{summary.total}</strong>
          <p>Total admin accounts created across organizations.</p>
        </article>
        <article className="portal-summary-card portal-summary-card-gold">
          <span>Pending Activations</span>
          <strong>{summary.pending}</strong>
          <p>Admins who still need to complete their first login.</p>
        </article>
        <article className="portal-summary-card">
          <span>Organizations Covered</span>
          <strong>{summary.organizations || activeOrganizations}</strong>
          <p>Organizations currently represented in the admin roster.</p>
        </article>
      </div>

      <div className="portal-list-card">
        <div className="portal-list-header">
          <div>
            <h2>Invited Admins</h2>
            <p>Every admin currently registered across the platform.</p>
          </div>
          <span className="portal-list-count">{invitedUsers.length} admins</span>
        </div>

        <div className="portal-list-table">
          <div className="portal-list-head portal-list-head-admin">
            <div>Name</div>
            <div>Email</div>
            <div>Organization</div>
            <div>Status</div>
          </div>

          {invitedUsers.map((user) => (
            <article key={user.id} className="portal-list-row portal-list-row-admin">
              <div>
                <strong>{user.name}</strong>
              </div>
              <div>{user.email}</div>
              <div>{user.organizationName || "Unassigned"}</div>
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
