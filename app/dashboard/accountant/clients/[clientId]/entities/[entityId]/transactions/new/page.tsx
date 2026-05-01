"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function AccountantAddTransactionPage() {
  const params = useParams<{ clientId: string; entityId: string }>();
  const clientId = String(params?.clientId || "");
  const entityId = String(params?.entityId || "");

  return (
    <section className="accountant-add-transaction-page">
      <Link
        href={`/dashboard/accountant/clients/${clientId}/entities/${entityId}`}
        className="accountant-back-link"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
          <path d="M9 12h10" />
        </svg>
        Back to Entity
      </Link>

      <div className="accountant-add-transaction-card">
        <div className="accountant-entity-section-title">
          <div>
            <h1>Add Transaction</h1>
            <p>Record a property transaction for Rodriguez Family SMSF.</p>
          </div>
          <span className="accountant-soft-badge">Manual Entry</span>
        </div>

        <div className="accountant-add-transaction-grid">
          <label>
            Property
            <select defaultValue="Sunset Villa">
              <option>Sunset Villa</option>
              <option>Ocean View Apartment</option>
              <option>Mountain Retreat</option>
            </select>
          </label>
          <label>
            Transaction Type
            <select defaultValue="Expense">
              <option>Expense</option>
              <option>Revenue</option>
            </select>
          </label>
          <label>
            Category
            <select defaultValue="Property Management">
              <option>Property Management</option>
              <option>Rental Income</option>
              <option>Repairs</option>
            </select>
          </label>
          <label>
            Sub-Category
            <input type="text" defaultValue="Management Fees" />
          </label>
          <label>
            Date
            <input type="text" defaultValue="Mar 18, 2026" />
          </label>
          <label>
            Amount
            <input type="text" defaultValue="$1,250.00" />
          </label>
          <label>
            GST
            <input type="text" defaultValue="$125.00" />
          </label>
          <label>
            Reference
            <input type="text" defaultValue="INV-2026-0318" />
          </label>
          <label className="is-wide">
            Description
            <textarea defaultValue="Property management fees for Sunset Villa." />
          </label>
        </div>

        <div className="accountant-entity-flow-footer">
          <Link
            href={`/dashboard/accountant/clients/${clientId}/entities/${entityId}`}
            className="accountant-form-cancel"
          >
            Cancel
          </Link>
          <Link
            href={`/dashboard/accountant/clients/${clientId}/entities/${entityId}`}
            className="accountant-form-save"
          >
            Save Transaction
          </Link>
        </div>
      </div>
    </section>
  );
}
