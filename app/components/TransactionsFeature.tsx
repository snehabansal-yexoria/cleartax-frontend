"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type TransactionType = "Expense" | "Income";

type StaticTransaction = {
  id: string;
  clientName: string;
  entityName: string;
  propertyName: string;
  type: TransactionType;
  category: string;
  subcategory: string;
  date: string;
  grossAmount: string;
  gst: string;
  netAmount: string;
  percentAmount: string;
  rule: boolean;
};

type StaticRule = {
  name: string;
  property: string;
  condition: string;
  setting: string;
  autoAdd: string;
  status: "Active" | "Inactive";
};

type SelectOption = {
  label: string;
  value: string;
};

type StaticSelectProps = {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
};

const transactions: StaticTransaction[] = [
  {
    id: "TXN-001",
    clientName: "John Smith",
    entityName: "Rodriguez Family SMSF",
    propertyName: "Sunset Villa",
    type: "Expense",
    category: "Property Management",
    subcategory: "Management Fees",
    date: "Mar 8, 2026",
    grossAmount: "-$1,250.00",
    gst: "$125.00",
    netAmount: "-$1,125.00",
    percentAmount: "$625.00(50%)",
    rule: true,
  },
  {
    id: "TXN-002",
    clientName: "John Smith",
    entityName: "Rodriguez Family SMSF",
    propertyName: "Ocean View",
    type: "Income",
    category: "Rental Income",
    subcategory: "Monthly Rent",
    date: "Mar 5, 2026",
    grossAmount: "$3,200.00",
    gst: "$0.00",
    netAmount: "$3,200.00",
    percentAmount: "$1,600.00(50%)",
    rule: false,
  },
  {
    id: "TXN-003",
    clientName: "Sarah Wilson",
    entityName: "Wilson Family Trust",
    propertyName: "Mountain Retreat",
    type: "Expense",
    category: "Repairs & Maintenance",
    subcategory: "Plumbing",
    date: "Mar 3, 2026",
    grossAmount: "-$850.00",
    gst: "$85.00",
    netAmount: "-$765.00",
    percentAmount: "$850.00(100%)",
    rule: true,
  },
  {
    id: "TXN-004",
    clientName: "Michael Chen",
    entityName: "Chen Investment Co",
    propertyName: "Downtown Loft",
    type: "Expense",
    category: "Utilities",
    subcategory: "Electricity",
    date: "Mar 1, 2026",
    grossAmount: "-$420.00",
    gst: "$42.00",
    netAmount: "-$378.00",
    percentAmount: "$139.986(33.33%)",
    rule: false,
  },
  {
    id: "TXN-005",
    clientName: "Sarah Wilson",
    entityName: "Wilson Family Trust",
    propertyName: "Mountain Retreat",
    type: "Income",
    category: "Rental Income",
    subcategory: "Monthly Rent",
    date: "Feb 28, 2026",
    grossAmount: "$2,800.00",
    gst: "$0.00",
    netAmount: "$2,800.00",
    percentAmount: "$2,800.00(100%)",
    rule: true,
  },
];

const hiddenTransactions: StaticTransaction[] = [
  {
    ...transactions[0],
    id: "TXN-006",
    propertyName: "Harbour View",
    category: "Insurance",
    subcategory: "Landlord Insurance",
    date: "Feb 24, 2026",
    grossAmount: "-$760.00",
    gst: "$76.00",
    netAmount: "-$684.00",
    percentAmount: "$380.00(50%)",
  },
  {
    ...transactions[1],
    id: "TXN-007",
    propertyName: "Sunset Villa",
    date: "Feb 21, 2026",
    grossAmount: "$3,050.00",
    netAmount: "$3,050.00",
    percentAmount: "$1,525.00(50%)",
  },
  {
    ...transactions[3],
    id: "TXN-008",
    category: "Council Rates",
    subcategory: "Quarterly Rates",
    date: "Feb 19, 2026",
    grossAmount: "-$610.00",
    gst: "$61.00",
    netAmount: "-$549.00",
    percentAmount: "$203.313(33.33%)",
  },
];

const transactionRows = [...transactions, ...hiddenTransactions];

const rules: StaticRule[] = [
  {
    name: "A Rental",
    property: "Sunset Villa",
    condition: 'Bank text contains "A Rental"',
    setting: "Expense > Travel",
    autoAdd: "-",
    status: "Active",
  },
];

const clientOptions = [
  "All Clients",
  "John Smith",
  "Sarah Wilson",
  "Michael Chen",
].map((value) => ({ label: value, value }));

const entityOptions = [
  "All Entities",
  "Rodriguez Family SMSF",
  "Wilson Family Trust",
  "Chen Investment Co",
].map((value) => ({ label: value, value }));

const propertyOptions = [
  "All Properties",
  "Sunset Villa",
  "Ocean View",
  "Mountain Retreat",
  "Downtown Loft",
].map((value) => ({ label: value, value }));

const typeOptions = ["All Types", "Expense", "Income"].map((value) => ({
  label: value,
  value,
}));

const categoryOptions = [
  "All Categories",
  "Property Management",
  "Rental Income",
  "Repairs & Maintenance",
  "Utilities",
  "Travel",
].map((value) => ({ label: value, value }));

const subcategoryOptions = [
  "Select sub-category",
  "Management Fees",
  "Monthly Rent",
  "Plumbing",
  "Electricity",
  "Flights",
].map((value) => ({ label: value, value }));

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16V5" />
      <path d="m7 10 5-5 5 5" />
      <path d="M5 19h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

function StaticSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  required,
  className = "",
}: StaticSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <div className={`transaction-field ${className}`}>
      {label && (
        <span className="transaction-field-label">
          {label}
          {required && <em>*</em>}
        </span>
      )}
      <div
        className={`property-status-select transaction-select${
          isOpen ? " is-open" : ""
        }`}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsOpen(false);
          }
        }}
      >
        <button
          type="button"
          className="property-status-trigger"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span>{selected?.label || placeholder || "Select"}</span>
          <ChevronIcon />
        </button>
        {isOpen && (
          <div className="property-status-menu" role="listbox">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={value === option.value}
                className={value === option.value ? "is-selected" : ""}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span>{option.label}</span>
                {value === option.value && (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12l4 4 10-10" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionTable({ compact = false }: { compact?: boolean }) {
  const rows = compact ? transactions : transactionRows;

  return (
    <div className="transactions-table-wrap">
      <table className="transactions-table">
        <thead>
          <tr>
            <th>Transaction ID</th>
            <th>Client Name</th>
            <th>Property Name</th>
            <th>Type</th>
            <th>Category</th>
            <th>Subcategory</th>
            <th>Date</th>
            <th>Gross Amount</th>
            <th>GST</th>
            <th>Net Amount</th>
            <th>% Amount</th>
            <th>Rule</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((transaction) => {
            const isIncome = transaction.type === "Income";
            return (
              <tr key={transaction.id}>
                <td>
                  <a href="#transaction">{transaction.id}</a>
                </td>
                <td>{transaction.clientName}</td>
                <td>{transaction.propertyName}</td>
                <td>
                  <span
                    className={`transaction-type-pill ${
                      isIncome ? "is-income" : "is-expense"
                    }`}
                  >
                    {transaction.type}
                  </span>
                </td>
                <td>{transaction.category}</td>
                <td>{transaction.subcategory}</td>
                <td>{transaction.date}</td>
                <td className={isIncome ? "amount-positive" : "amount-negative"}>
                  {transaction.grossAmount}
                </td>
                <td>{transaction.gst}</td>
                <td className={isIncome ? "amount-positive" : "amount-negative"}>
                  {transaction.netAmount}
                </td>
                <td>{transaction.percentAmount}</td>
                <td>
                  <span
                    className={`transaction-rule-pill ${
                      transaction.rule ? "is-yes" : "is-no"
                    }`}
                  >
                    {transaction.rule ? "Yes" : "No"}
                  </span>
                </td>
                <td>
                  <div className="transaction-action-set">
                    <button type="button" aria-label={`Edit ${transaction.id}`}>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="is-danger"
                      aria-label={`Delete ${transaction.id}`}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v5" />
                        <path d="M14 11v5" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ copy }: { copy: string }) {
  return (
    <div className="transactions-pagination-row">
      <span>{copy}</span>
      <div className="transactions-pagination">
        <button type="button" disabled>
          Previous
        </button>
        <button type="button" className="is-current">
          1
        </button>
        <button type="button" disabled>
          Next
        </button>
      </div>
    </div>
  );
}

function Filters() {
  const [client, setClient] = useState("All Clients");
  const [entity, setEntity] = useState("All Entities");
  const [property, setProperty] = useState("All Properties");
  const [type, setType] = useState("All Types");
  const [category, setCategory] = useState("All Categories");

  return (
    <section className="transaction-filter-card" aria-label="Transaction filters">
      <div className="transaction-filter-title">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V22h-4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.8 15a1.7 1.7 0 0 0-1.5-1H3v-4h.3a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V2h4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.3v4h-.3a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
        <strong>Filters</strong>
      </div>
      <div className="transaction-filter-grid">
        <StaticSelect
          label="Client Name"
          value={client}
          options={clientOptions}
          onChange={setClient}
        />
        <StaticSelect
          label="Entity Name"
          value={entity}
          options={entityOptions}
          onChange={setEntity}
        />
        <StaticSelect
          label="Property Name"
          value={property}
          options={propertyOptions}
          onChange={setProperty}
        />
        <StaticSelect
          label="Transaction Type"
          value={type}
          options={typeOptions}
          onChange={setType}
        />
        <StaticSelect
          label="Category"
          value={category}
          options={categoryOptions}
          onChange={setCategory}
        />
      </div>
    </section>
  );
}

export function AllTransactionsView({
  addTransactionHref = "/dashboard/accountant/transactions/new",
  rulesHref = "/dashboard/accountant/transactions/rules",
  compact = false,
}: {
  addTransactionHref?: string;
  rulesHref?: string;
  compact?: boolean;
}) {
  return (
    <section className={`transactions-page${compact ? " is-compact" : ""}`}>
      <div className="transactions-page-head">
        <div>
          <h1>All Transactions</h1>
          <p>View and manage all transactions across clients and properties</p>
        </div>
        <div className="transactions-head-actions">
          <Link href={rulesHref} className="transaction-outline-button">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 4v16" />
              <path d="M18 4v16" />
              <path d="M4 8h4" />
              <path d="M16 16h4" />
              <path d="M10 12h4" />
            </svg>
            Transaction Rules
          </Link>
          <Link href={addTransactionHref} className="transaction-primary-button">
            <span>+</span>
            Add Transaction
          </Link>
        </div>
      </div>

      <Filters />

      <div className="transactions-showing-copy">
        Showing <strong>8</strong> of <strong>8</strong> transactions
      </div>
      <TransactionTable compact={compact} />
      <Pagination copy="Showing 8 of 8 items" />
    </section>
  );
}

function BulkImportModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: () => void;
}) {
  const [entity, setEntity] = useState("Select Entity");
  const [property, setProperty] = useState("Select Property");
  const [hasFile, setHasFile] = useState(false);
  const canImport =
    entity !== "Select Entity" && property !== "Select Property" && hasFile;

  return (
    <div className="transaction-modal-layer">
      <button
        type="button"
        className="transaction-modal-backdrop"
        aria-label="Close bulk import"
        onClick={onClose}
      />
      <section className="transaction-modal transaction-bulk-modal">
        <header className="transaction-modal-header">
          <div>
            <h2>Bulk Import from CSV</h2>
            <p>Upload multiple transactions at once</p>
          </div>
          <button type="button" aria-label="Close bulk import" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>

        <div className="transaction-modal-body">
          <h3>Entity & Property</h3>
          <div className="transaction-two-grid">
            <StaticSelect
              label="Entity Name"
              required
              value={entity}
              options={[
                { label: "Select Entity", value: "Select Entity" },
                ...entityOptions.slice(1),
              ]}
              onChange={setEntity}
            />
            <StaticSelect
              label="Property Name"
              required
              value={property}
              options={[
                { label: "Select Property", value: "Select Property" },
                ...propertyOptions.slice(1),
              ]}
              onChange={setProperty}
            />
          </div>

          <div className="csv-template-card">
            <div>
              <strong>Download Sample CSV Template</strong>
              <span>Use this template to format your transaction data</span>
            </div>
            <button type="button">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
              Download
            </button>
          </div>

          <div>
            <span className="transaction-field-label">
              Upload CSV File<em>*</em>
            </span>
            <button
              type="button"
              className={`csv-dropzone${hasFile ? " has-file" : ""}`}
              onClick={() => setHasFile(true)}
            >
              <span className="csv-dropzone-icon">
                <UploadIcon />
              </span>
              <strong>
                {hasFile
                  ? "transactions_march_2026.csv"
                  : "Drop CSV file here or click to browse"}
              </strong>
              <small>Only .csv files are supported</small>
            </button>
          </div>
        </div>

        <footer className="transaction-modal-footer">
          <button type="button" className="transaction-cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="transaction-save-button"
            disabled={!canImport}
            onClick={onImport}
          >
            Import Transactions
          </button>
        </footer>
      </section>
    </div>
  );
}

function EntityPropertyWarning() {
  return (
    <section className="transaction-warning-card">
      <strong>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5" />
          <path d="M12 16h.01" />
        </svg>
        Please select Entity Name and Property Name to continue
      </strong>
      <div>
        <span>
          <small>Entity Name</small>
          <b>Not selected</b>
        </span>
        <button type="button" aria-label="Edit entity">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
        </button>
        <span>
          <small>Property Name</small>
          <b>Not selected</b>
        </span>
        <button type="button" aria-label="Edit property">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
        </button>
      </div>
    </section>
  );
}

export function AddTransactionView({
  backHref = "/dashboard/accountant/transactions",
  backLabel = "Back",
}: {
  backHref?: string;
  backLabel?: string;
}) {
  const [category, setCategory] = useState("Select category");
  const [subcategory, setSubcategory] = useState("Select sub-category");
  const [type, setType] = useState<TransactionType | "">("");
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isMarked, setIsMarked] = useState(false);

  if (isMarked) {
    return (
      <section className="transactions-page">
        <div className="transaction-success-card">
          <h1>Transaction Marked !</h1>
          <p>
            Added one more to list. The Client&apos;s real-time balance has been
            updated accordingly.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="transactions-page transaction-add-page">
      <Link href={backHref} className="entity-wizard-back transaction-back-link">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        {backLabel}
      </Link>

      <div className="transactions-page-head">
        <div>
          <h1>Add Transactions</h1>
          <p>Upload and process transaction documents with automatic data extraction</p>
        </div>
        <button
          type="button"
          className="transaction-outline-button"
          onClick={() => setIsBulkOpen(true)}
        >
          <UploadIcon />
          Bulk Import from CSV
        </button>
      </div>

      <div className="transaction-add-layout">
        <button type="button" className="transaction-document-drop">
          <span>
            <UploadIcon />
          </span>
          <strong>Drop your document here</strong>
          <small>or click to browse</small>
        </button>

        <form
          className="transaction-entry-form"
          onSubmit={(event) => {
            event.preventDefault();
            setIsMarked(true);
          }}
        >
          <EntityPropertyWarning />

          <div className="transaction-type-control">
            <span className="transaction-field-label">
              Transaction Type<em>*</em>
            </span>
            <div>
              <button
                type="button"
                className={type === "Expense" ? "is-selected" : ""}
                onClick={() => setType("Expense")}
              >
                Expense
              </button>
              <button
                type="button"
                className={type === "Income" ? "is-selected" : ""}
                onClick={() => setType("Income")}
              >
                Revenue
              </button>
            </div>
          </div>

          <div className="transaction-form-grid">
            <StaticSelect
              label="Category"
              required
              value={category}
              options={[
                { label: "Select category", value: "Select category" },
                ...categoryOptions.slice(1),
              ]}
              onChange={setCategory}
            />
            <StaticSelect
              label="Sub-Category"
              required
              value={subcategory}
              options={subcategoryOptions}
              onChange={setSubcategory}
            />
            <label className="transaction-field">
              <span className="transaction-field-label">
                Invoice Date<em>*</em>
              </span>
              <input type="text" placeholder="dd/mm/yyyy" />
            </label>
            <label className="transaction-field">
              <span className="transaction-field-label">
                Amount<em>*</em>
              </span>
              <input type="text" placeholder="$  0.00" />
            </label>
          </div>

          <label className="transaction-field">
            <span className="transaction-field-label">Description</span>
            <textarea placeholder="Add description" />
          </label>

          <label className="transaction-field">
            <span className="transaction-field-label">Add Internal Remarks</span>
            <input type="text" placeholder="Add Remarks" />
          </label>

          <div className="transaction-form-actions">
            <Link href={backHref} className="transaction-cancel-button">
              Cancel
            </Link>
            <button type="submit" className="transaction-save-button">
              Save Transaction
            </button>
          </div>
        </form>
      </div>

      {isBulkOpen && (
        <BulkImportModal
          onClose={() => setIsBulkOpen(false)}
          onImport={() => {
            setIsBulkOpen(false);
            setIsMarked(true);
          }}
        />
      )}
    </section>
  );
}

function RuleModal({
  mode,
  onClose,
}: {
  mode: "create" | "edit";
  onClose: () => void;
}) {
  const [entity, setEntity] = useState("Select entity");
  const [property, setProperty] = useState("All Properties");
  const [match, setMatch] = useState("All");
  const [field, setField] = useState("Description");
  const [operator, setOperator] = useState("Contains");
  const [type, setType] = useState("Select Type");
  const [category, setCategory] = useState("Select Category");
  const [subcategory, setSubcategory] = useState("Select Sub Category");
  const [ruleName, setRuleName] = useState(mode === "edit" ? "A Rental" : "");
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [enabled, setEnabled] = useState(mode === "create");

  const canSave = Boolean(ruleName.trim()) && enabled;

  return (
    <div className="transaction-modal-layer">
      <button
        type="button"
        className="transaction-modal-backdrop"
        aria-label="Close rule"
        onClick={onClose}
      />
      <section className="transaction-modal transaction-rule-modal">
        <header className="transaction-modal-header">
          <div>
            <h2>{mode === "edit" ? "Edit Rule" : "Create Rule"}</h2>
            <p>Rules only apply to unreviewed transactions</p>
          </div>
          <button type="button" aria-label="Close rule" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>

        <div className="transaction-modal-body rule-modal-body">
          <label className="transaction-field">
            <span className="transaction-field-label">
              Rule Name<em>*</em>
            </span>
            <input
              type="text"
              placeholder="e.g., A Rental"
              value={ruleName}
              onChange={(event) => setRuleName(event.target.value)}
            />
          </label>

          <h3>Entity & Property</h3>
          <div className="transaction-two-grid">
            <StaticSelect
              value={entity}
              options={[
                { label: "Select entity", value: "Select entity" },
                ...entityOptions.slice(1),
              ]}
              onChange={setEntity}
            />
            <StaticSelect
              value={property}
              options={propertyOptions}
              onChange={setProperty}
            />
          </div>

          <h3>If</h3>
          <section className="rule-condition-card">
            <div className="rule-match-row">
              <span>Match</span>
              <StaticSelect
                value={match}
                options={["All", "Any"].map((value) => ({ label: value, value }))}
                onChange={setMatch}
                className="is-mini"
              />
              <span>of the following:</span>
            </div>
            <div className="rule-condition-row">
              <StaticSelect
                value={field}
                options={["Description", "Bank text", "Amount", "Payee"].map(
                  (value) => ({ label: value, value }),
                )}
                onChange={setField}
              />
              <StaticSelect
                value={operator}
                options={["Contains", "Equals", "Starts with", "Is greater than"].map(
                  (value) => ({ label: value, value }),
                )}
                onChange={setOperator}
              />
              <input type="text" placeholder="Enter value" />
            </div>
            <button type="button" className="rule-add-condition">
              + Add a condition
            </button>
            <div className="rule-divider" />
            <button type="button" className="transaction-cancel-button">
              Test Rule
            </button>
          </section>

          <h3>Then Assign</h3>
          <StaticSelect
            label="Transaction Type"
            value={type}
            options={[
              { label: "Select Type", value: "Select Type" },
              { label: "Expense", value: "Expense" },
              { label: "Income", value: "Income" },
            ]}
            onChange={setType}
          />
          <StaticSelect
            label="Category"
            value={category}
            options={[
              { label: "Select Category", value: "Select Category" },
              ...categoryOptions.slice(1),
            ]}
            onChange={setCategory}
          />
          <StaticSelect
            label="Sub Category"
            value={subcategory}
            options={[
              { label: "Select Sub Category", value: "Select Sub Category" },
              ...subcategoryOptions.slice(1),
            ]}
            onChange={setSubcategory}
          />

          <ToggleCard
            checked={autoConfirm}
            onChange={setAutoConfirm}
            title="Automatically confirm transactions this rule applies to"
            subtitle="If disabled, the rule will suggest the category but require manual confirmation"
          />
          {mode === "create" && (
            <ToggleCard
              checked={enabled}
              onChange={setEnabled}
              title="Enable this rule"
              subtitle="If disabled, the rule will not be applied to transactions"
              green
            />
          )}
        </div>

        <footer className="transaction-modal-footer">
          <button type="button" className="transaction-cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="transaction-save-button"
            disabled={!canSave}
            onClick={onClose}
          >
            Save
          </button>
        </footer>
      </section>
    </div>
  );
}

function ToggleCard({
  checked,
  onChange,
  title,
  subtitle,
  green = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  subtitle: string;
  green?: boolean;
}) {
  return (
    <button
      type="button"
      className="rule-toggle-card"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <span
        className={`rule-toggle${checked ? " is-on" : ""}${
          green ? " is-green" : ""
        }`}
      >
        <i />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
    </button>
  );
}

export function TransactionRulesView({
  backHref = "/dashboard/accountant/transactions",
}: {
  backHref?: string;
}) {
  const [query, setQuery] = useState("");
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);

  const filteredRules = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rules;
    return rules.filter((rule) =>
      [rule.name, rule.condition, rule.setting, rule.property]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [query]);

  return (
    <section className="transactions-page transaction-rules-page">
      <Link href={backHref} className="entity-wizard-back transaction-back-link">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Back to transactions
      </Link>

      <div className="transactions-page-head">
        <div>
          <h1>Transaction Rules</h1>
          <p>Automate transaction categorisation with custom rules</p>
        </div>
        <button
          type="button"
          className="transaction-green-button"
          onClick={() => setModalMode("create")}
        >
          <span>+</span>
          New Rule
        </button>
      </div>

      <section className="transaction-rule-search-card">
        <div className="transaction-rule-search">
          <SearchIcon />
          <input
            type="text"
            value={query}
            placeholder="Search by name or conditions"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </section>

      <div className="transaction-rule-table-wrap">
        <table className="transaction-rule-table">
          <thead>
            <tr>
              <th>Rule Name</th>
              <th>Applied To</th>
              <th>Conditions</th>
              <th>Settings</th>
              <th>Auto-Add</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRules.map((rule) => (
              <tr key={rule.name}>
                <td>
                  <button type="button" onClick={() => setModalMode("edit")}>
                    {rule.name}
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 16v-4" />
                      <path d="M12 8h.01" />
                    </svg>
                  </button>
                </td>
                <td>
                  <span className="rule-property-pill">{rule.property}</span>
                </td>
                <td>{rule.condition}</td>
                <td>{rule.setting}</td>
                <td>{rule.autoAdd}</td>
                <td>
                  <span className="rule-status-pill">{rule.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination copy={`Showing ${filteredRules.length} of ${rules.length} items`} />

      {modalMode && (
        <RuleModal mode={modalMode} onClose={() => setModalMode(null)} />
      )}
    </section>
  );
}
