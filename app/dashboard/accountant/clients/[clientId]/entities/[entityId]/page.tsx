"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

const transactions = [
  ["TXN-001", "Sunset Villa", "Expense", "Expense", "Property Management Fees", "Mar 8, 2026", "-$1,250.00", "$125.00", "Yes"],
  ["TXN-002", "Ocean View", "Revenue", "Income", "Rental Income", "Mar 5, 2026", "+$3,200.00", "$320.00", "No"],
  ["TXN-003", "Mountain Retreat", "Expense", "Expense", "Repairs", "Mar 3, 2026", "-$850.00", "NA", "Yes"],
];

export default function AccountantEntityDetailPage() {
  const params = useParams<{ clientId: string; entityId: string }>();
  const clientId = String(params?.clientId || "");
  const entityId = String(params?.entityId || "rodriguez-family-smsf");

  return (
    <section className="accountant-entity-detail-page">
      <Link
        href={`/dashboard/accountant/clients/${clientId}`}
        className="accountant-back-link"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
          <path d="M9 12h10" />
        </svg>
        Back to Priya Mehta
      </Link>

      <section className="accountant-entity-hero-card">
        <div className="accountant-entity-hero-header">
          <h1>Rodriguez Family SMSF</h1>
          <button type="button" className="accountant-outline-button">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Edit Details
          </button>
        </div>

        <div className="accountant-entity-facts">
          <div>
            <span>Entity Type</span>
            <strong>Self Manage Super Fund</strong>
          </div>
          <div>
            <span>Created at</span>
            <strong>March 10, 2020</strong>
          </div>
          <div>
            <span>Total Properties</span>
            <strong>5</strong>
          </div>
          <div>
            <span>Total Transactions</span>
            <strong>56</strong>
          </div>
        </div>

        <div className="accountant-entity-beneficiaries">
          <span>Beneficiaries</span>
          <strong>Micheal Chen <em>60%</em></strong>
        </div>
      </section>

      <div className="accountant-entity-kpi-grid">
        <article>
          <span>Total Income</span>
          <strong>$245,600</strong>
          <small className="is-good">↗</small>
        </article>
        <article>
          <span>Total Expenses</span>
          <strong>$162,400</strong>
          <small className="is-bad">⌁</small>
        </article>
        <article>
          <span>Net Profit</span>
          <strong className="is-good-text">+$83,200</strong>
          <small className="is-blue">$</small>
        </article>
      </div>

      <section className="accountant-entity-manager-card">
        <h2>Relationship Manager</h2>
        <div>
          <div className="accountant-empty-person">
            <span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
            </span>
            <div>
              <strong>No Relationship Manager Assigned</strong>
              <p>Please select a relationship manager from the dropdown below to assign them to this entity.</p>
            </div>
          </div>
          <label>
            Select Relationship Manager
            <input type="text" aria-label="Select relationship manager" />
          </label>
        </div>
      </section>

      <section className="accountant-entity-chart-card">
        <div className="accountant-entity-section-title">
          <h2>Profit & Loss Trend</h2>
          <div className="accountant-segmented-control">
            <button type="button" className="is-active">Graph View</button>
            <button type="button">Table View</button>
          </div>
        </div>
        <div className="accountant-profit-chart" aria-label="Profit and loss trend">
          {["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr"].map((month, index) => (
            <div key={month} className="accountant-profit-bar-group">
              <span style={{ height: `${58 + (index % 3) * 8}px` }} />
              <strong style={{ height: `${48 + ((index + 1) % 3) * 14}px` }} />
              <em>{month}</em>
            </div>
          ))}
        </div>
        <div className="accountant-chart-legend">
          <span><i /> Expenses</span>
          <span><i /> Income</span>
        </div>
      </section>

      <section className="accountant-entity-tabs-card">
        <div className="accountant-entity-mini-tabs">
          <button type="button">Properties</button>
          <button type="button" className="is-active">Transactions</button>
          <button type="button">Documents</button>
        </div>

        <div className="accountant-entity-section-title">
          <h2>Entity Transactions</h2>
          <div className="accountant-entity-actions">
            <Link
              href={`/dashboard/accountant/clients/${clientId}/entities/${entityId}/reconciliation`}
              className="accountant-success-cta"
            >
              Reconcile Transaction
            </Link>
            <Link
              href={`/dashboard/accountant/clients/${clientId}/entities/${entityId}/transactions/new`}
              className="accountant-primary-cta"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              Add Transaction
            </Link>
          </div>
        </div>

        <div className="accountant-entity-filter-grid">
          <label>Property Name<select><option>All Properties</option></select></label>
          <label>Transaction Type<select><option>All Types</option></select></label>
          <label>Category<select><option>All Categories</option></select></label>
          <label>Sub-Category<select><option>All Sub-Categories</option></select></label>
        </div>

        <div className="accountant-entity-transaction-table">
          <div className="accountant-entity-transaction-head">
            <span>Transaction ID</span><span>Property Name</span><span>Type</span><span>Category</span><span>Subcategory</span><span>Date</span><span>Amount</span><span>GST</span><span>Rule</span>
          </div>
          {transactions.map((row) => (
            <div key={row[0]} className="accountant-entity-transaction-row">
              {row.map((cell, index) => (
                <span key={`${row[0]}-${cell}`} className={index === 2 ? `pill-${cell.toLowerCase()}` : index === 6 ? "amount-cell" : ""}>
                  {cell}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
