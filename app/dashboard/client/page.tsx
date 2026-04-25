"use client";

import { Skeleton } from "boneyard-js/react";
import { useEffect, useState } from "react";
import { AccountantDashboardSkeleton } from "../../components/PortalSkeletons";
import { getSession } from "../../../src/lib/session";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

interface ClientContextResponse {
  company: {
    id: string;
    name: string;
  } | null;
  managedBy: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export default function ClientPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerRole, setManagerRole] = useState("");

  useEffect(() => {
    async function loadClientContext() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;

        if (!session) {
          return;
        }

        const token = session.getIdToken().getJwtToken();
        const res = await fetch("/api/users/me/client-context", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as ClientContextResponse;
        setCompanyName(data.company?.name || "");
        setManagerName(data.managedBy?.name || "");
        setManagerEmail(data.managedBy?.email || "");
        setManagerRole(data.managedBy?.role || "");
      } catch (error) {
        console.error("Failed to load client context:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadClientContext();
  }, []);

  return (
    <Skeleton
      name="client-dashboard"
      loading={isLoading}
      fallback={<AccountantDashboardSkeleton />}
    >
      <section className="portal-page">
        <div className="portal-page-header">
          <div>
            <p className="portal-kicker">Client Workspace</p>
            <h1>Client Dashboard</h1>
            <p>
              {companyName
                ? `Your portfolio is currently managed within ${companyName}.`
                : "View your portfolio workspace and management details."}
            </p>
          </div>

          <div className="portal-header-actions">
            <button type="button" className="portal-primary-link" disabled>
              Create Entity
            </button>
          </div>
        </div>

        <div className="portal-summary-grid">
          <article className="portal-summary-card portal-summary-card-blue">
            <span>Managed Company</span>
            <strong>{companyName || "Not linked"}</strong>
            <p>
              {companyName
                ? "This is the organization currently servicing your account."
                : "Your company assignment will appear here once linked."}
            </p>
          </article>

          <article className="portal-summary-card portal-summary-card-gold">
            <span>Managed By</span>
            <strong>{managerName || "Pending"}</strong>
            <p>
              {managerEmail
                ? `${managerRole || "account manager"} • ${managerEmail}`
                : "We will show your assigned accountant or admin here."}
            </p>
          </article>

          <article className="portal-summary-card">
            <span>Next Step</span>
            <strong>Entity Setup</strong>
            <p>
              The `Create Entity` button is ready in the UI and we can wire the
              full flow next.
            </p>
          </article>
        </div>

        <div className="portal-list-card">
          <div className="portal-list-header">
            <div>
              <h2>Account Overview</h2>
              <p>
                A quick snapshot of who manages your account and where your
                workspace is anchored.
              </p>
            </div>
          </div>

          <div className="portal-list-table">
            <div className="portal-list-head portal-list-head-admin">
              <div>Company</div>
              <div>Manager</div>
              <div>Email</div>
              <div>Role</div>
            </div>

            <article className="portal-list-row portal-list-row-admin">
              <div>{companyName || "-"}</div>
              <div>{managerName || "-"}</div>
              <div>{managerEmail || "-"}</div>
              <div>{managerRole || "-"}</div>
            </article>
          </div>
        </div>
      </section>
    </Skeleton>
  );
}
