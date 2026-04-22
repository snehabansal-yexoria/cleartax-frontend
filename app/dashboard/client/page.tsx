"use client";

import { useRouter } from "next/navigation";
import { logout } from "../../../src/lib/logout";

export default function ClientPage() {
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <section className="portal-page">
      <div className="portal-page-header">
        <div>
          <p className="portal-kicker">Client Workspace</p>
          <h1>Client Panel</h1>
          <p>View your property portfolio and financial data.</p>
        </div>

        <button
          type="button"
          className="portal-secondary-link"
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>

      <div className="portal-summary-grid">
        <article className="portal-summary-card portal-summary-card-blue">
          <span>Portfolio Status</span>
          <strong>Active</strong>
          <p>Your workspace is ready for document review and updates.</p>
        </article>
        <article className="portal-summary-card portal-summary-card-gold">
          <span>Documents</span>
          <strong>12</strong>
          <p>Recent files and uploaded statements available in your portal.</p>
        </article>
        <article className="portal-summary-card">
          <span>Next Step</span>
          <strong>Review</strong>
          <p>Check your latest tasks, statements, and onboarding items.</p>
        </article>
      </div>
    </section>
  );
}
