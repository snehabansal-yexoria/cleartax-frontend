"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getSession } from "@/src/lib/session";
import type {
  CoreAssetClass,
  CorePropertyTransactionRow,
  CoreTransactionCategory,
  CoreTransactionListItem,
  CoreTransactionSubcategory,
  CoreTransactionType,
} from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): { getJwtToken(): string };
}

export type TransactionsContext =
  | { kind: "client"; clientId: string }
  | { kind: "entity"; entityId: string }
  | { kind: "property"; propertyId: string }
  | { kind: "none" };

type TransactionTableScope = "global" | "client" | "entity";

type DisplayTransactionRow = CoreTransactionListItem & {
  clientName?: string;
};

type ClientRecord = {
  id: string;
  name: string;
};

const NUMERIC_FORMATTER = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return NUMERIC_FORMATTER.format(value);
}

function formatInvoiceDate(value: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

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

function TransactionTable({
  rows,
  scope,
  showClientShare = false,
}: {
  rows: DisplayTransactionRow[];
  scope: TransactionTableScope;
  showClientShare?: boolean;
}) {
  const showClientName = scope === "global";
  const showEntityName = scope !== "entity";

  return (
    <div className="transactions-table-wrap">
      <table className="transactions-table">
        <thead>
          <tr>
            <th>Transaction ID</th>
            {showClientName ? <th>Client Name</th> : null}
            {showEntityName ? <th>Entity</th> : null}
            <th>Properties</th>
            <th>Type</th>
            <th>Category</th>
            <th>Subcategory</th>
            <th>Date</th>
            <th>Gross</th>
            <th>GST</th>
            <th>Net</th>
            {showClientShare ? <th>Client Share</th> : null}
            <th>Rule</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isRevenue = row.type === "revenue";
            const propertyLabel =
              row.propertyNames.length === 0
                ? "—"
                : row.propertyNames.length === 1
                  ? row.propertyNames[0]
                  : `${row.propertyNames[0]} +${row.propertyNames.length - 1}`;
            return (
              <tr key={row.id}>
                <td>
                  <a href={`/dashboard/accountant/transactions/${row.id}`}>
                    {row.id.slice(0, 8)}…
                  </a>
                </td>
                {showClientName ? <td>{row.clientName || "—"}</td> : null}
                {showEntityName ? <td>{row.entityName || "—"}</td> : null}
                <td title={row.propertyNames.join(", ")}>{propertyLabel}</td>
                <td>
                  <span
                    className={`transaction-type-pill ${
                      isRevenue ? "is-income" : "is-expense"
                    }`}
                  >
                    {isRevenue ? "Revenue" : "Expense"}
                  </span>
                </td>
                <td>{row.categoryName}</td>
                <td>{row.subcategoryName}</td>
                <td>{formatInvoiceDate(row.invoiceDate)}</td>
                <td className={isRevenue ? "amount-positive" : "amount-negative"}>
                  {formatCurrency(row.grossAmount)}
                </td>
                <td>{formatCurrency(row.gstAmount)}</td>
                <td className={isRevenue ? "amount-positive" : "amount-negative"}>
                  {formatCurrency(row.netAmount)}
                </td>
                {showClientShare ? (
                  <td>
                    {row.clientShareNet != null
                      ? formatCurrency(row.clientShareNet)
                      : "—"}
                  </td>
                ) : null}
                <td>
                  <span
                    className={`transaction-rule-pill ${
                      row.ruleId != null ? "is-yes" : "is-no"
                    }`}
                  >
                    {row.ruleId != null ? "Yes" : "No"}
                  </span>
                </td>
                <td>
                  <div className="transaction-action-set">
                    <button type="button" aria-label={`Edit ${row.id}`}>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="is-danger"
                      aria-label={`Delete ${row.id}`}
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

function PropertyTransactionTable({
  rows,
}: {
  rows: CorePropertyTransactionRow[];
}) {
  return (
    <div className="transactions-table-wrap">
      <table className="transactions-table">
        <thead>
          <tr>
            <th>Transaction ID</th>
            <th>Type</th>
            <th>Category</th>
            <th>Subcategory</th>
            <th>Date</th>
            <th>Bill total</th>
            <th>Split %</th>
            <th>Property share</th>
            <th>GST</th>
            <th>Net</th>
            <th>Rule</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isRevenue = row.transactionType === "revenue";
            return (
              <tr key={`${row.transactionId}-${row.splitId}`}>
                <td>
                  <a href={`/dashboard/accountant/transactions/${row.transactionId}`}>
                    {row.transactionId.slice(0, 8)}…
                  </a>
                </td>
                <td>
                  <span
                    className={`transaction-type-pill ${
                      isRevenue ? "is-income" : "is-expense"
                    }`}
                  >
                    {isRevenue ? "Revenue" : "Expense"}
                  </span>
                </td>
                <td>{row.categoryName}</td>
                <td>{row.subcategoryName}</td>
                <td>{formatInvoiceDate(row.invoiceDate)}</td>
                <td>{formatCurrency(row.transactionGrossAmount)}</td>
                <td>{row.splitPercentage.toFixed(2)}%</td>
                <td className={isRevenue ? "amount-positive" : "amount-negative"}>
                  {formatCurrency(row.splitGrossAmount)}
                </td>
                <td>{formatCurrency(row.splitGstAmount)}</td>
                <td className={isRevenue ? "amount-positive" : "amount-negative"}>
                  {formatCurrency(row.splitNetAmount)}
                </td>
                <td>
                  <span
                    className={`transaction-rule-pill ${
                      row.ruleId != null ? "is-yes" : "is-no"
                    }`}
                  >
                    {row.ruleId != null ? "Yes" : "No"}
                  </span>
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

function Filters({ context }: { context: TransactionsContext }) {
  const [client, setClient] = useState("All Clients");
  const [entity, setEntity] = useState("All Entities");
  const [property, setProperty] = useState("All Properties");
  const [type, setType] = useState("All Types");
  const [category, setCategory] = useState("All Categories");

  const showClientFilter = context.kind === "none";
  const showEntityFilter = context.kind === "none" || context.kind === "client";
  const showPropertyFilter = context.kind !== "property";

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
        {showClientFilter ? (
          <StaticSelect
            label="Client Name"
            value={client}
            options={clientOptions}
            onChange={setClient}
          />
        ) : null}
        {showEntityFilter ? (
          <StaticSelect
            label="Entity Name"
            value={entity}
            options={entityOptions}
            onChange={setEntity}
          />
        ) : null}
        {showPropertyFilter ? (
          <StaticSelect
            label="Property Name"
            value={property}
            options={propertyOptions}
            onChange={setProperty}
          />
        ) : null}
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
  context = { kind: "none" },
  addTransactionHref = "/dashboard/accountant/transactions/new",
  rulesHref = "/dashboard/accountant/transactions/rules",
  compact = false,
}: {
  context?: TransactionsContext;
  addTransactionHref?: string;
  rulesHref?: string;
  compact?: boolean;
}) {
  const [rows, setRows] = useState<DisplayTransactionRow[]>([]);
  const [propertyRows, setPropertyRows] = useState<CorePropertyTransactionRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const contextKind = context.kind;
  const contextId =
    context.kind === "client"
      ? context.clientId
      : context.kind === "entity"
        ? context.entityId
        : context.kind === "property"
          ? context.propertyId
          : "";

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage("");

    async function load() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) {
          if (!cancelled) setErrorMessage("You're signed out.");
          return;
        }
        const token = session.getIdToken().getJwtToken();

        if (contextKind === "none") {
          const clientsRes = await fetch("/api/users/me/clients?scope=mine", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!clientsRes.ok) {
            if (!cancelled) setErrorMessage("Failed to load clients.");
            return;
          }
          const clientsData = (await clientsRes.json()) as {
            clients?: ClientRecord[];
          };
          const clients = clientsData.clients || [];
          const responses = await Promise.all(
            clients.map(async (client) => {
              const res = await fetch(
                `/api/clients/${encodeURIComponent(client.id)}/transactions`,
                { headers: { Authorization: `Bearer ${token}` } },
              );
              if (!res.ok) return [];
              const data = (await res.json()) as {
                items?: CoreTransactionListItem[];
              };
              return (data.items || []).map((item) => ({
                ...item,
                clientName: client.name,
              }));
            }),
          );
          if (!cancelled) {
            setRows(responses.flat());
            setPropertyRows([]);
          }
          return;
        }

        let url = "";
        switch (contextKind) {
          case "client":
            url = `/api/clients/${encodeURIComponent(contextId)}/transactions`;
            break;
          case "entity":
            url = `/api/entities/${encodeURIComponent(contextId)}/transactions`;
            break;
          case "property":
            url = `/api/properties/${encodeURIComponent(contextId)}/transactions`;
            break;
        }

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (!cancelled) setErrorMessage("Failed to load transactions.");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (contextKind === "property") {
          setPropertyRows((data.items as CorePropertyTransactionRow[]) || []);
          setRows([]);
        } else {
          setRows((data.items as DisplayTransactionRow[]) || []);
          setPropertyRows([]);
        }
      } catch (error) {
        console.error("Failed to load transactions:", error);
        if (!cancelled) {
          setErrorMessage("Unexpected error loading transactions.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [contextId, contextKind]);

  const totalCount =
    contextKind === "property" ? propertyRows.length : rows.length;
  const showClientShare = contextKind === "client";
  const tableScope: TransactionTableScope =
    contextKind === "none"
      ? "global"
      : contextKind === "client"
        ? "client"
        : "entity";

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

      <Filters context={context} />

      {isLoading ? (
        <div className="transactions-showing-copy">Loading transactions…</div>
      ) : errorMessage ? (
        <div className="transactions-showing-copy">{errorMessage}</div>
      ) : totalCount === 0 ? (
        <div className="transactions-showing-copy">No transactions yet.</div>
      ) : (
        <>
          <div className="transactions-showing-copy">
            Showing <strong>{totalCount}</strong> of{" "}
            <strong>{totalCount}</strong> transactions
          </div>
          {contextKind === "property" ? (
            <PropertyTransactionTable rows={propertyRows} />
          ) : (
            <TransactionTable
              rows={rows}
              scope={tableScope}
              showClientShare={showClientShare}
            />
          )}
          <Pagination copy={`Showing ${totalCount} of ${totalCount} items`} />
        </>
      )}
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

function EditPencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function RemoveRowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
    </svg>
  );
}

type EntityOption = { id: string; name: string };
type PropertyOption = { id: string; name: string };

const MODE_OF_TRANSACTION_OPTIONS: SelectOption[] = [
  { label: "Select mode of transaction", value: "" },
  { label: "Cash", value: "cash" },
  { label: "Bank Transfer", value: "bank_transfer" },
  { label: "Credit Card", value: "credit_card" },
  { label: "Cheque", value: "cheque" },
  { label: "Direct Debit", value: "direct_debit" },
  { label: "Other", value: "other" },
];

const ASSET_CLASSES: { value: CoreAssetClass; label: string }[] = [
  { value: "capital_works", label: "Capital Works" },
  { value: "capital_allowance", label: "Capital Allowance" },
];

let splitRowCounter = 0;
function makeSplitRowId() {
  splitRowCounter += 1;
  return `split-${splitRowCounter}`;
}

type SplitRowState = { id: string; propertyId: string; amount: string };

function EntityPropertyHeaderCard({
  entities,
  properties,
  activeEntityId,
  activePropertyId,
  isEditingEntity,
  isEditingProperty,
  isPropertyRequired,
  isEntityLockable,
  isPropertyLockable,
  onSelectEntity,
  onSelectProperty,
  onEditEntity,
  onEditProperty,
}: {
  entities: EntityOption[];
  properties: PropertyOption[];
  activeEntityId: string;
  activePropertyId: string;
  isEditingEntity: boolean;
  isEditingProperty: boolean;
  isPropertyRequired: boolean;
  isEntityLockable: boolean;
  isPropertyLockable: boolean;
  onSelectEntity: (id: string) => void;
  onSelectProperty: (id: string) => void;
  onEditEntity: () => void;
  onEditProperty: () => void;
}) {
  const entityName =
    entities.find((e) => e.id === activeEntityId)?.name || "Not selected";
  const propertyName =
    properties.find((p) => p.id === activePropertyId)?.name || "Not selected";

  return (
    <section className="transaction-entity-header">
      <div>
        {isEditingEntity ? (
          <StaticSelect
            label="Entity Name"
            required
            value={activeEntityId}
            options={[
              { label: "Select Entity", value: "" },
              ...entities.map((e) => ({ label: e.name, value: e.id })),
            ]}
            onChange={onSelectEntity}
          />
        ) : (
          <span>
            <small>Entity Name</small>
            <b>{entityName}</b>
          </span>
        )}
        {!isEditingEntity && isEntityLockable ? (
          <button type="button" aria-label="Edit entity" onClick={onEditEntity}>
            <EditPencilIcon />
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        {isEditingProperty ? (
          <StaticSelect
            label="Property Name"
            required={isPropertyRequired}
            value={activePropertyId}
            options={[
              { label: "Select Property", value: "" },
              ...properties.map((p) => ({ label: p.name, value: p.id })),
            ]}
            onChange={onSelectProperty}
          />
        ) : (
          <span>
            <small>Property Name</small>
            <b>{propertyName}</b>
          </span>
        )}
        {!isEditingProperty && isPropertyLockable ? (
          <button
            type="button"
            aria-label="Edit property"
            onClick={onEditProperty}
          >
            <EditPencilIcon />
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
    </section>
  );
}

export function AddTransactionView({
  entityId,
  backHref = "/dashboard/accountant/transactions",
  backLabel = "Back",
}: {
  entityId?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);

  const [type, setType] = useState<CoreTransactionType | "">("");
  const [categories, setCategories] = useState<CoreTransactionCategory[]>([]);
  const [subcategories, setSubcategories] = useState<CoreTransactionSubcategory[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);

  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [activeEntityId, setActiveEntityId] = useState<string>(entityId ?? "");
  const [isEditingEntity, setIsEditingEntity] = useState<boolean>(!entityId);

  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [propertyId, setPropertyId] = useState<string>("");
  const [isEditingProperty, setIsEditingProperty] = useState<boolean>(true);

  const [invoiceDate, setInvoiceDate] = useState("");
  const [grossAmount, setGrossAmount] = useState("");

  const [showGstBreakdown, setShowGstBreakdown] = useState(false);
  const [gstAmount, setGstAmount] = useState("");

  const [isSplit, setIsSplit] = useState(false);
  const [splitRows, setSplitRows] = useState<SplitRowState[]>(() => [
    { id: makeSplitRowId(), propertyId: "", amount: "" },
  ]);

  const [modeOfTransaction, setModeOfTransaction] = useState<string>("");

  const [description, setDescription] = useState("");
  const [internalRemarks, setInternalRemarks] = useState("");

  const [isAssetPurchase, setIsAssetPurchase] = useState(false);
  const [assetClass, setAssetClass] = useState<CoreAssetClass | "">("");
  const [effectiveLifeYears, setEffectiveLifeYears] = useState("");

  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isMarked, setIsMarked] = useState(false);

  // Resolve the bearer token once on mount.
  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (cancelled) return;
        setToken(session ? session.getIdToken().getJwtToken() : null);
      } finally {
        if (!cancelled) setTokenLoaded(true);
      }
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load entities for the picker (and to look up the locked entity name).
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function loadEntities() {
      const res = await fetch("/api/entities", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { items?: EntityOption[] };
      if (!cancelled) setEntities(data.items || []);
    }
    loadEntities();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Load properties whenever the active entity changes.
  useEffect(() => {
    if (!token || !activeEntityId) {
      setProperties([]);
      setPropertyId("");
      setSplitRows([{ id: makeSplitRowId(), propertyId: "", amount: "" }]);
      return;
    }
    let cancelled = false;
    async function loadProperties() {
      const res = await fetch(
        `/api/entities/${encodeURIComponent(activeEntityId)}/properties`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { items?: PropertyOption[] };
      if (!cancelled) {
        setProperties(data.items || []);
        setPropertyId("");
        setSplitRows([{ id: makeSplitRowId(), propertyId: "", amount: "" }]);
      }
    }
    loadProperties();
    return () => {
      cancelled = true;
    };
  }, [token, activeEntityId]);

  // Load categories whenever the type changes.
  useEffect(() => {
    if (!token || !type) {
      setCategories([]);
      setCategoryId(null);
      return;
    }
    let cancelled = false;
    async function loadCategories() {
      const res = await fetch(
        `/api/transactions/categories?type=${encodeURIComponent(type)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { items?: CoreTransactionCategory[] };
      if (!cancelled) {
        setCategories(data.items || []);
        setCategoryId(null);
        setSubcategoryId(null);
      }
    }
    loadCategories();
    return () => {
      cancelled = true;
    };
  }, [token, type]);

  // Load subcategories whenever the category changes.
  useEffect(() => {
    if (!token || !categoryId) {
      setSubcategories([]);
      setSubcategoryId(null);
      return;
    }
    let cancelled = false;
    async function loadSubcategories() {
      const res = await fetch(
        `/api/transactions/categories/${categoryId}/sub-categories`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { items?: CoreTransactionSubcategory[] };
      if (!cancelled) {
        setSubcategories(data.items || []);
        setSubcategoryId(null);
      }
    }
    loadSubcategories();
    return () => {
      cancelled = true;
    };
  }, [token, categoryId]);

  // When the user un-checks "asset purchase", reset its dependent fields.
  useEffect(() => {
    if (!isAssetPurchase) {
      setAssetClass("");
      setEffectiveLifeYears("");
    }
  }, [isAssetPurchase]);

  // When GST breakdown is unchecked, drop any entered GST so the body omits it.
  useEffect(() => {
    if (!showGstBreakdown) setGstAmount("");
  }, [showGstBreakdown]);

  const grossNumberValue = Number.parseFloat(grossAmount);
  const splitTotal = splitRows.reduce(
    (sum, r) => sum + (Number.parseFloat(r.amount) || 0),
    0,
  );
  const splitMatches =
    !Number.isNaN(grossNumberValue) &&
    grossNumberValue > 0 &&
    Math.abs(splitTotal - grossNumberValue) < 0.01;

  const splitErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!isSplit) return errors;
    const seen = new Set<string>();
    for (const r of splitRows) {
      if (!r.propertyId) {
        errors[r.id] = "Choose a property.";
      } else if (seen.has(r.propertyId)) {
        errors[r.id] = "Property already used in another split.";
      } else if (!r.amount || Number.parseFloat(r.amount) <= 0) {
        errors[r.id] = "Enter a positive amount.";
      }
      if (r.propertyId) seen.add(r.propertyId);
    }
    return errors;
  }, [isSplit, splitRows]);

  const canSubmit =
    !!activeEntityId &&
    !!type &&
    !!categoryId &&
    !!subcategoryId &&
    !!invoiceDate &&
    !!grossAmount &&
    !!modeOfTransaction &&
    (isSplit
      ? splitRows.length > 0 &&
        Object.keys(splitErrors).length === 0 &&
        splitMatches
      : !!propertyId);

  function updateSplitRow(id: string, patch: Partial<SplitRowState>) {
    setSplitRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  function addSplitRow() {
    setSplitRows((rows) => [
      ...rows,
      { id: makeSplitRowId(), propertyId: "", amount: "" },
    ]);
  }

  function removeSplitRow(id: string) {
    setSplitRows((rows) =>
      rows.length <= 1 ? rows : rows.filter((r) => r.id !== id),
    );
  }

  function handleEntityPicked(id: string) {
    setActiveEntityId(id);
    setIsEditingEntity(false);
    setIsEditingProperty(true);
  }

  function handlePropertyPicked(id: string) {
    setPropertyId(id);
    if (id) setIsEditingProperty(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeEntityId || !token) {
      setSubmitError("Please select an entity to continue.");
      return;
    }
    setSubmitError("");
    setIsSubmitting(true);
    try {
      const grossNum = Number.parseFloat(grossAmount);
      if (Number.isNaN(grossNum) || grossNum < 0) {
        setSubmitError("Amount must be a non-negative number.");
        return;
      }

      let gstNum: number | null = null;
      if (showGstBreakdown && gstAmount) {
        const parsed = Number.parseFloat(gstAmount);
        if (Number.isNaN(parsed) || parsed < 0) {
          setSubmitError("GST must be a non-negative number.");
          return;
        }
        gstNum = parsed;
      }

      let splits: Array<Record<string, unknown>>;
      if (isSplit) {
        if (Object.keys(splitErrors).length > 0) {
          setSubmitError("Fix the errors in the split rows.");
          return;
        }
        if (!splitMatches) {
          setSubmitError(
            `Split amounts must total ${grossNum.toFixed(
              2,
            )} (currently ${splitTotal.toFixed(2)}).`,
          );
          return;
        }
        splits = splitRows.map((r) => {
          const rowAmount = Number.parseFloat(r.amount);
          return {
            property_id: r.propertyId,
            split_percentage: Number(((rowAmount / grossNum) * 100).toFixed(4)),
            split_gross_amount: Number(rowAmount.toFixed(2)),
          };
        });
      } else {
        if (!propertyId) {
          setSubmitError("Please select a property.");
          return;
        }
        splits = [{ property_id: propertyId, split_percentage: 100 }];
      }

      const body: Record<string, unknown> = {
        type,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        invoice_date: invoiceDate,
        gross_amount: grossNum,
        description: description.trim() || null,
        internal_remarks: internalRemarks.trim() || null,
        is_asset_purchase: isAssetPurchase,
        splits,
      };
      if (gstNum !== null) {
        body.gst_amount = gstNum;
      }
      if (modeOfTransaction) {
        body.metadata = { mode_of_transaction: modeOfTransaction };
      }
      if (isAssetPurchase) {
        body.asset_class = assetClass || null;
        if (assetClass === "capital_allowance") {
          const yearsNum = Number.parseFloat(effectiveLifeYears);
          if (Number.isNaN(yearsNum) || yearsNum <= 0) {
            setSubmitError("Effective life must be a positive number.");
            return;
          }
          body.effective_life_years = yearsNum;
        }
      }

      const res = await fetch(
        `/api/entities/${encodeURIComponent(activeEntityId)}/transactions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;
        setSubmitError(
          data?.message || data?.error || `Save failed (${res.status}).`,
        );
        return;
      }
      setIsMarked(true);
    } catch (error) {
      console.error("Failed to save transaction:", error);
      setSubmitError("Unexpected error saving transaction.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isMarked) {
    return (
      <section className="transactions-page">
        <div className="transaction-success-card">
          <h1>Transaction Marked !</h1>
          <p>
            Added one more to list. The Client&apos;s real-time balance has been
            updated accordingly.
          </p>
          <button
            type="button"
            className="transaction-primary-button"
            onClick={() => router.push(backHref)}
          >
            Back to transactions
          </button>
        </div>
      </section>
    );
  }

  if (tokenLoaded && !token) {
    return (
      <section className="transactions-page">
        <div className="transaction-success-card">
          <h1>Sign-in required</h1>
          <p>Please sign in to add a transaction.</p>
        </div>
      </section>
    );
  }

  const categorySelectOptions: SelectOption[] = [
    { label: "Select category", value: "" },
    ...categories.map((c) => ({ label: c.name, value: String(c.id) })),
  ];
  const subcategorySelectOptions: SelectOption[] = [
    { label: "Select sub-category", value: "" },
    ...subcategories.map((s) => ({ label: s.name, value: String(s.id) })),
  ];
  const assetClassOptions: SelectOption[] = [
    { label: "Select class", value: "" },
    ...ASSET_CLASSES.map((a) => ({ label: a.label, value: a.value })),
  ];
  const splitPropertyBaseOptions = properties.map((p) => ({
    label: p.name,
    value: p.id,
  }));

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

        <form className="transaction-entry-form" onSubmit={handleSubmit}>
          <EntityPropertyHeaderCard
            entities={entities}
            properties={properties}
            activeEntityId={activeEntityId}
            activePropertyId={propertyId}
            isEditingEntity={isEditingEntity}
            isEditingProperty={isEditingProperty}
            isPropertyRequired={!isSplit}
            isEntityLockable={!!activeEntityId}
            isPropertyLockable={!!propertyId}
            onSelectEntity={handleEntityPicked}
            onSelectProperty={handlePropertyPicked}
            onEditEntity={() => setIsEditingEntity(true)}
            onEditProperty={() => setIsEditingProperty(true)}
          />

          <div className="transaction-type-control">
            <span className="transaction-field-label">
              Transaction Type<em>*</em>
            </span>
            <div>
              <button
                type="button"
                className={type === "expense" ? "is-selected" : ""}
                onClick={() => setType("expense")}
              >
                Expense
              </button>
              <button
                type="button"
                className={
                  type === "revenue" ? "is-selected is-revenue" : ""
                }
                onClick={() => setType("revenue")}
              >
                Revenue
              </button>
            </div>
          </div>

          <div className="transaction-form-grid">
            <StaticSelect
              label="Category"
              required
              value={categoryId == null ? "" : String(categoryId)}
              options={categorySelectOptions}
              onChange={(value) => setCategoryId(value ? Number(value) : null)}
            />
            <StaticSelect
              label="Sub-Category"
              required
              value={subcategoryId == null ? "" : String(subcategoryId)}
              options={subcategorySelectOptions}
              onChange={(value) =>
                setSubcategoryId(value ? Number(value) : null)
              }
            />
            <label className="transaction-field">
              <span className="transaction-field-label">
                Invoice Date<em>*</em>
              </span>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </label>
            <label className="transaction-field">
              <span className="transaction-field-label">
                Amount<em>*</em>
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={grossAmount}
                onChange={(e) => setGrossAmount(e.target.value)}
              />
            </label>
          </div>

          <label className="transaction-checkbox-row">
            <input
              type="checkbox"
              checked={showGstBreakdown}
              onChange={(e) => setShowGstBreakdown(e.target.checked)}
            />
            <span>Add GST Breakdown</span>
          </label>

          {showGstBreakdown ? (
            <label className="transaction-field">
              <span className="transaction-field-label">
                GST Amount<em>*</em>
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={gstAmount}
                onChange={(e) => setGstAmount(e.target.value)}
              />
            </label>
          ) : null}

          <label className="transaction-checkbox-row">
            <input
              type="checkbox"
              checked={isSplit}
              onChange={(e) => setIsSplit(e.target.checked)}
            />
            <span>Is this a split transaction?</span>
          </label>

          {isSplit ? (
            <div className="transaction-split-section">
              {splitRows.map((row, index) => (
                <div key={row.id} className="transaction-split-row">
                  <StaticSelect
                    label={index === 0 ? "Property Name" : undefined}
                    required
                    value={row.propertyId}
                    options={[
                      { label: "Select Property", value: "" },
                      ...splitPropertyBaseOptions,
                    ]}
                    onChange={(value) =>
                      updateSplitRow(row.id, { propertyId: value })
                    }
                  />
                  <label className="transaction-field">
                    {index === 0 ? (
                      <span className="transaction-field-label">
                        Amount<em>*</em>
                      </span>
                    ) : null}
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={row.amount}
                      onChange={(e) =>
                        updateSplitRow(row.id, { amount: e.target.value })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="transaction-split-remove"
                    aria-label="Remove split row"
                    disabled={splitRows.length <= 1}
                    onClick={() => removeSplitRow(row.id)}
                  >
                    <RemoveRowIcon />
                  </button>
                  {splitErrors[row.id] ? (
                    <p className="transaction-split-row-error">
                      {splitErrors[row.id]}
                    </p>
                  ) : null}
                </div>
              ))}
              <div className="transaction-split-footer">
                <span
                  className={`transaction-split-total${
                    grossAmount && !splitMatches ? " is-mismatch" : ""
                  }`}
                >
                  {grossAmount && !Number.isNaN(grossNumberValue)
                    ? `Split total: ${splitTotal.toFixed(
                        2,
                      )} of ${grossNumberValue.toFixed(2)}`
                    : "Enter the total amount above to validate splits."}
                </span>
                <button
                  type="button"
                  className="transaction-split-add"
                  onClick={addSplitRow}
                  disabled={!properties.length}
                >
                  + Add Property
                </button>
              </div>
            </div>
          ) : null}

          <StaticSelect
            label="Mode of Transaction"
            required
            value={modeOfTransaction}
            options={MODE_OF_TRANSACTION_OPTIONS}
            onChange={setModeOfTransaction}
          />

          <label className="transaction-field">
            <span className="transaction-field-label">Description</span>
            <textarea
              placeholder="Add description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <label className="transaction-field">
            <span className="transaction-field-label">Add Internal Remarks</span>
            <input
              type="text"
              placeholder="Add Remarks"
              value={internalRemarks}
              onChange={(e) => setInternalRemarks(e.target.value)}
            />
          </label>

          {type === "expense" ? (
            <div
              className="transaction-asset-block"
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <label className="transaction-checkbox-row">
                <input
                  type="checkbox"
                  checked={isAssetPurchase}
                  onChange={(e) => setIsAssetPurchase(e.target.checked)}
                />
                <span>Is this an asset purchase?</span>
              </label>
              {isAssetPurchase ? (
                <div className="transaction-form-grid" style={{ marginTop: 12 }}>
                  <StaticSelect
                    label="Asset Class"
                    required
                    value={assetClass}
                    options={assetClassOptions}
                    onChange={(value) =>
                      setAssetClass((value as CoreAssetClass) || "")
                    }
                  />
                  {assetClass === "capital_allowance" ? (
                    <label className="transaction-field">
                      <span className="transaction-field-label">
                        Effective life (years)<em>*</em>
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min="0"
                        placeholder="e.g. 10"
                        value={effectiveLifeYears}
                        onChange={(e) => setEffectiveLifeYears(e.target.value)}
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {submitError ? (
            <p className="transaction-warning-card" role="alert">
              {submitError}
            </p>
          ) : null}

          <div className="transaction-form-actions">
            <Link href={backHref} className="transaction-cancel-button">
              Cancel
            </Link>
            <button
              type="submit"
              className="transaction-save-button"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>

      {isBulkOpen && (
        <BulkImportModal
          onClose={() => setIsBulkOpen(false)}
          onImport={() => {
            setIsBulkOpen(false);
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
