"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "boneyard-js/react";
import { PropertyDetailSkeleton } from "@/app/components/PortalSkeletons";
import { getSession } from "@/src/lib/session";
import type { CoreEntity, CoreProperty } from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

type ReviewLine = {
  id: string;
  label: string;
  amount: string;
  use: string;
  expandable?: boolean;
};

type OwnerLine = {
  id: string;
  name: string;
  percentage: string;
};

type LogitFormReviewProps = {
  propertyId: string;
  backHref: string;
};

const incomeRows: ReviewLine[] = [
  { id: "rental-income", label: "Rental income", amount: "", use: "" },
  {
    id: "other-rental-income",
    label: "Other rental income",
    amount: "",
    use: "",
  },
];

const expenseRows: ReviewLine[] = [
  { id: "advertising", label: "Advertising for tenants", amount: "", use: "" },
  { id: "body-corporate", label: "Body corporate fees", amount: "", use: "" },
  { id: "cleaning", label: "Cleaning", amount: "", use: "" },
  { id: "council-rates", label: "Council Rates", amount: "", use: "" },
  { id: "gardening-a", label: "Gardening/lawn mowing", amount: "", use: "" },
  { id: "gardening-b", label: "Gardening/lawn mowing", amount: "", use: "" },
  {
    id: "insurance",
    label: "Insurance",
    amount: "",
    use: "",
    expandable: true,
  },
  { id: "land-tax", label: "Land Tax", amount: "", use: "" },
  {
    id: "legal-fees",
    label: "Legal fees",
    amount: "",
    use: "",
    expandable: true,
  },
  { id: "pest-control", label: "Pest Control", amount: "", use: "" },
  {
    id: "agent-fees",
    label: "Property Agent Fees/ commission",
    amount: "",
    use: "",
    expandable: true,
  },
  {
    id: "repairs",
    label: "Repairs and Maintenance",
    amount: "",
    use: "",
    expandable: true,
  },
  { id: "water", label: "Water charges", amount: "", use: "" },
  {
    id: "sundry",
    label: "Sundry Rental Expenses",
    amount: "",
    use: "",
    expandable: true,
  },
];

const borrowingRows: ReviewLine[] = [
  {
    id: "interest",
    label: "Interest on loans",
    amount: "",
    use: "",
    expandable: true,
  },
  {
    id: "borrowing",
    label: "Borrowing expense",
    amount: "",
    use: "",
    expandable: true,
  },
];

const depreciationRows: ReviewLine[] = [
  {
    id: "capital-allowances",
    label: "Capital allowances",
    amount: "",
    use: "",
  },
  {
    id: "capital-works",
    label: "Capital works deductions",
    amount: "",
    use: "",
  },
];

function titleCase(value: string) {
  if (!value) return "";
  return value
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function toInputDate(value: string | null | undefined) {
  return value?.slice(0, 10) || "";
}

function getLoanDetail(property: CoreProperty | null, key: string) {
  const value = property?.loanDetails?.[key];
  return value == null ? "" : String(value);
}

function getRowsTotal(rows: ReviewLine[], key: "amount" | "use") {
  return rows.reduce((sum, row) => {
    const amount = Number.parseFloat(row[key]);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

function inputNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "";
}

export default function LogitFormReview({
  propertyId,
  backHref,
}: LogitFormReviewProps) {
  const router = useRouter();
  const [property, setProperty] = useState<CoreProperty | null>(null);
  const [entity, setEntity] = useState<CoreEntity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [locality, setLocality] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [postcode, setPostcode] = useState("");
  const [acquisitionDate, setAcquisitionDate] = useState("");
  const [acquisitionCost, setAcquisitionCost] = useState("");
  const [disposalDate, setDisposalDate] = useState("");
  const [disposalProceeds, setDisposalProceeds] = useState("");
  const [dateFirstEarnedRent, setDateFirstEarnedRent] = useState("");
  const [weeksRented, setWeeksRented] = useState("52");
  const [weeksAvailable, setWeeksAvailable] = useState("");
  const [dateAvailable, setDateAvailable] = useState("");
  const [hasLoan, setHasLoan] = useState(false);
  const [owners, setOwners] = useState<OwnerLine[]>([]);
  const [rentedIncome, setRentedIncome] = useState<ReviewLine[]>(incomeRows);
  const [rentedExpenses, setRentedExpenses] =
    useState<ReviewLine[]>(expenseRows);
  const [borrowings, setBorrowings] = useState<ReviewLine[]>(borrowingRows);
  const [depreciation, setDepreciation] =
    useState<ReviewLine[]>(depreciationRows);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) {
          router.replace("/login/user");
          return;
        }

        const token = session.getIdToken().getJwtToken();
        const propertyRes = await fetch(
          `/api/properties/${encodeURIComponent(propertyId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (cancelled) return;
        if (!propertyRes.ok) {
          setLoadError("Failed to load the property review form.");
          return;
        }

        const loadedProperty = (await propertyRes.json()) as CoreProperty;
        setProperty(loadedProperty);
        setAddressLine1(loadedProperty.locationText || loadedProperty.name);
        setAcquisitionDate(toInputDate(loadedProperty.purchaseDate));
        setAcquisitionCost(inputNumber(loadedProperty.purchaseAmount));
        setHasLoan(Boolean(loadedProperty.loanDetails));
        setOwners(
          loadedProperty.owners.length > 0
            ? loadedProperty.owners.map((owner, index) => ({
                id: String(owner.id ?? index),
                name: owner.ownerName,
                percentage: inputNumber(owner.ownershipPercentage),
              }))
            : [{ id: "primary", name: "", percentage: "100" }],
        );

        const entityRes = await fetch(
          `/api/entities/${encodeURIComponent(loadedProperty.entityId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (!cancelled && entityRes.ok) {
          setEntity((await entityRes.json()) as CoreEntity);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load logit form review:", error);
          setLoadError("Unexpected error loading the property review form.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (propertyId) load();
    return () => {
      cancelled = true;
    };
  }, [propertyId, router]);

  const totals = useMemo(() => {
    const incomeAmount = getRowsTotal(rentedIncome, "amount");
    const incomeUse = getRowsTotal(rentedIncome, "use");
    const expenseAmount =
      getRowsTotal(rentedExpenses, "amount") +
      getRowsTotal(borrowings, "amount") +
      getRowsTotal(depreciation, "amount");
    const expenseUse =
      getRowsTotal(rentedExpenses, "use") +
      getRowsTotal(borrowings, "use") +
      getRowsTotal(depreciation, "use");

    return {
      incomeAmount,
      incomeUse,
      rentalExpenseAmount: getRowsTotal(rentedExpenses, "amount"),
      rentalExpenseUse: getRowsTotal(rentedExpenses, "use"),
      borrowingAmount: getRowsTotal(borrowings, "amount"),
      borrowingUse: getRowsTotal(borrowings, "use"),
      depreciationAmount: getRowsTotal(depreciation, "amount"),
      depreciationUse: getRowsTotal(depreciation, "use"),
      expenseAmount,
      expenseUse,
    };
  }, [borrowings, depreciation, rentedExpenses, rentedIncome]);

  function updateOwner(id: string, key: "name" | "percentage", value: string) {
    setOwners((current) =>
      current.map((owner) =>
        owner.id === id ? { ...owner, [key]: value } : owner,
      ),
    );
  }

  function addOwner() {
    setOwners((current) => [
      ...current,
      { id: crypto.randomUUID(), name: "", percentage: "" },
    ]);
  }

  function updateLine(
    group: "income" | "expenses" | "borrowings" | "depreciation",
    id: string,
    key: "amount" | "use",
    value: string,
  ) {
    const updater = (rows: ReviewLine[]) =>
      rows.map((row) => (row.id === id ? { ...row, [key]: value } : row));

    if (group === "income") setRentedIncome(updater);
    if (group === "expenses") setRentedExpenses(updater);
    if (group === "borrowings") setBorrowings(updater);
    if (group === "depreciation") setDepreciation(updater);
  }

  async function handleSubmit() {
    setFormError("");
    setSuccessMessage("");

    const ownershipTotal = owners.reduce((sum, owner) => {
      const value = Number.parseFloat(owner.percentage);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    if (
      !addressLine1.trim() ||
      !locality.trim() ||
      !stateValue.trim() ||
      !postcode.trim()
    ) {
      setFormError("Complete the required address fields before lodging.");
      return;
    }

    if (
      owners.some((owner) => !owner.name.trim() || !owner.percentage.trim())
    ) {
      setFormError("Each owner needs a name and ownership percentage.");
      return;
    }

    if (ownershipTotal <= 0 || ownershipTotal > 100) {
      setFormError(
        "Ownership percentage must be greater than 0 and no more than 100.",
      );
      return;
    }

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsSubmitting(false);
    setSuccessMessage(
      "Logit form reviewed successfully. The export is ready to lodge.",
    );
  }

  if (isLoading) {
    return (
      <Skeleton
        name="logit-form-review-page"
        loading
        fallback={<PropertyDetailSkeleton />}
      >
        <PropertyDetailSkeleton />
      </Skeleton>
    );
  }

  if (!property) {
    return (
      <section className="client-detail-page property-detail-page property-detail-shell">
        <Link href={backHref} className="entity-wizard-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back to Property
        </Link>
        <p className="entity-wizard-error">
          {loadError || "Property review form not found."}
        </p>
      </section>
    );
  }

  return (
    <section className="client-detail-page logit-review-page property-detail-shell">
      <Link href={backHref} className="entity-wizard-back">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Back to Property
      </Link>

      <header className="logit-review-head">
        <div>
          <h1>Logit Form Review</h1>
          <p>
            Review and validate all rental property information before
            submission
          </p>
        </div>
      </header>

      {loadError && <p className="logit-alert is-error">{loadError}</p>}
      {formError && <p className="logit-alert is-error">{formError}</p>}
      {successMessage && (
        <p className="logit-alert is-success">{successMessage}</p>
      )}

      <form
        className="logit-review-form"
        onSubmit={(event) => event.preventDefault()}
      >
        <section className="entity-wizard-card logit-card">
          <header>
            <h2>Address</h2>
            <p>Enter the basic information about the property</p>
          </header>
          <div className="entity-wizard-selected-chip property-entity-chip">
            <span>
              Entity: <strong>{entity?.name || "-"}</strong>
            </span>
            <span>
              Type:{" "}
              <strong>{entity ? titleCase(entity.entityType) : "-"}</strong>
            </span>
          </div>
          <label className="entity-wizard-label">
            <span>
              Property Name <em>*</em>
            </span>
            <input value={property.name} readOnly />
          </label>
          <div className="logit-grid">
            <label className="entity-wizard-label">
              <span>
                Address Line 1 <em>*</em>
              </span>
              <input
                value={addressLine1}
                onChange={(event) => setAddressLine1(event.target.value)}
              />
            </label>
            <label className="entity-wizard-label">
              Address Line 2
              <input
                placeholder="Apartment, suite, etc. (optional)"
                value={addressLine2}
                onChange={(event) => setAddressLine2(event.target.value)}
              />
            </label>
          </div>
          <div className="logit-grid-3">
            <label className="entity-wizard-label">
              <span>
                Locality <em>*</em>
              </span>
              <input
                value={locality}
                onChange={(event) => setLocality(event.target.value)}
              />
            </label>
            <label className="entity-wizard-label">
              <span>
                State <em>*</em>
              </span>
              <input
                value={stateValue}
                onChange={(event) => setStateValue(event.target.value)}
              />
            </label>
            <label className="entity-wizard-label">
              <span>
                Postcode <em>*</em>
              </span>
              <input
                value={postcode}
                onChange={(event) => setPostcode(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="entity-wizard-card logit-card">
          <header>
            <h2>Acquisition & Disposal Details</h2>
            <p>Details about property purchase and sale</p>
          </header>
          <div className="logit-grid">
            <label className="entity-wizard-label">
              Acquisition Date
              <input
                type="date"
                className="property-date-input"
                value={acquisitionDate}
                onChange={(event) => setAcquisitionDate(event.target.value)}
              />
            </label>
            <label className="entity-wizard-label">
              Acquisition Cost
              <input
                type="number"
                min="0"
                placeholder="$"
                value={acquisitionCost}
                onChange={(event) => setAcquisitionCost(event.target.value)}
              />
            </label>
            <label className="entity-wizard-label">
              Disposal Date
              <input
                type="date"
                className="property-date-input"
                value={disposalDate}
                onChange={(event) => setDisposalDate(event.target.value)}
              />
            </label>
            <label className="entity-wizard-label">
              Disposal Proceeds
              <input
                type="number"
                min="0"
                placeholder="$"
                value={disposalProceeds}
                onChange={(event) => setDisposalProceeds(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="entity-wizard-card logit-card">
          <header>
            <h2>Rental Period Details</h2>
            <p>Information about rental activity</p>
          </header>
          <label className="entity-wizard-label">
            Date first earned rent
            <input
              type="date"
              className="property-date-input"
              value={dateFirstEarnedRent}
              onChange={(event) => setDateFirstEarnedRent(event.target.value)}
            />
          </label>
          <div className="logit-grid">
            <label className="entity-wizard-label">
              Weeks rented during year
              <input
                type="number"
                min="0"
                max="52"
                value={weeksRented}
                onChange={(event) => setWeeksRented(event.target.value)}
              />
            </label>
            <label className="entity-wizard-label">
              Weeks available for rent
              <input
                type="number"
                min="0"
                max="52"
                value={weeksAvailable}
                onChange={(event) => setWeeksAvailable(event.target.value)}
              />
            </label>
          </div>
          <label className="entity-wizard-label">
            Date available for rent
            <input
              type="date"
              className="property-date-input"
              value={dateAvailable}
              onChange={(event) => setDateAvailable(event.target.value)}
            />
          </label>
        </section>

        <section className="entity-wizard-card logit-card">
          <header>
            <h2>Loan Details</h2>
            <p>Loan negotiation information</p>
          </header>
          <fieldset className="property-wizard-radio logit-radio">
            <legend>Has a loan</legend>
            <label>
              <input
                type="radio"
                checked={hasLoan}
                onChange={() => setHasLoan(true)}
              />
              Yes
            </label>
            <label>
              <input
                type="radio"
                checked={!hasLoan}
                onChange={() => setHasLoan(false)}
              />
              No
            </label>
          </fieldset>
          {hasLoan && (
            <div className="logit-grid">
              <label className="entity-wizard-label">
                Bank name
                <input defaultValue={getLoanDetail(property, "bank_name")} />
              </label>
              <label className="entity-wizard-label">
                Loan amount
                <input
                  type="number"
                  min="0"
                  defaultValue={getLoanDetail(property, "loan_amount")}
                />
              </label>
            </div>
          )}
        </section>

        <section className="entity-wizard-card logit-card">
          <header>
            <h2>Ownership Details</h2>
            <p>Define ownership structure</p>
          </header>
          <div className="logit-owner-list">
            {owners.map((owner) => (
              <div key={owner.id} className="logit-owner-row">
                <label className="entity-wizard-label">
                  <span>
                    Owner name <em>*</em>
                  </span>
                  <input
                    placeholder="Enter owner name"
                    value={owner.name}
                    onChange={(event) =>
                      updateOwner(owner.id, "name", event.target.value)
                    }
                  />
                </label>
                <label className="entity-wizard-label">
                  <span>
                    Ownership percentage <em>*</em>
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="%"
                    value={owner.percentage}
                    onChange={(event) =>
                      updateOwner(owner.id, "percentage", event.target.value)
                    }
                  />
                </label>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="entity-beneficiary-add"
            onClick={addOwner}
          >
            + Add Owner
          </button>
        </section>

        <LogitTable
          title="Rented Income Section"
          subtitle="Record all rental income received"
          label="Income Type"
          rows={rentedIncome}
          totalLabel="Total Income"
          totalAmount={totals.incomeAmount}
          totalUse={totals.incomeUse}
          onChange={(id, key, value) => updateLine("income", id, key, value)}
        />

        <LogitTable
          title="Rented Expense Categories"
          subtitle="Track all rental property expenses"
          label="Expense Type"
          rows={rentedExpenses}
          totalLabel="Total Rental Expenses"
          totalAmount={totals.rentalExpenseAmount}
          totalUse={totals.rentalExpenseUse}
          onChange={(id, key, value) => updateLine("expenses", id, key, value)}
        />

        <LogitTable
          title="Borrowing & Finances"
          subtitle="Loan interest and borrowing costs"
          label="Finance Type"
          rows={borrowings}
          totalLabel="Total Borrowing Expenses"
          totalAmount={totals.borrowingAmount}
          totalUse={totals.borrowingUse}
          onChange={(id, key, value) =>
            updateLine("borrowings", id, key, value)
          }
        />

        <LogitTable
          title="Depreciation"
          subtitle="Capital allowances and works deductions"
          label="Depreciation Type"
          rows={depreciation}
          totalLabel="Total Depreciation Expenses"
          totalAmount={totals.depreciationAmount}
          totalUse={totals.depreciationUse}
          onChange={(id, key, value) =>
            updateLine("depreciation", id, key, value)
          }
        />

        <div className="logit-grand-total">
          <strong>Total Expenses</strong>
          <span>{formatMoney(totals.expenseAmount)}</span>
          <span>{formatMoney(totals.expenseUse)}</span>
        </div>

        <div className="logit-form-actions">
          <Link href={backHref} className="entity-wizard-secondary">
            Cancel
          </Link>
          <button
            type="button"
            className="entity-wizard-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Lodging..." : "Lodge and Export"}
          </button>
        </div>
      </form>
    </section>
  );
}

function LogitTable({
  title,
  subtitle,
  label,
  rows,
  totalLabel,
  totalAmount,
  totalUse,
  onChange,
}: {
  title: string;
  subtitle: string;
  label: string;
  rows: ReviewLine[];
  totalLabel: string;
  totalAmount: number;
  totalUse: number;
  onChange: (id: string, key: "amount" | "use", value: string) => void;
}) {
  return (
    <section className="entity-wizard-card logit-card">
      <header>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>
      <div className="logit-table" role="table">
        <div className="logit-table-head" role="row">
          <span>{label}</span>
          <span>Amount</span>
          <span>Use (%)</span>
        </div>
        {rows.map((row) => (
          <div className="logit-table-row" role="row" key={row.id}>
            <span>
              {row.expandable && <b aria-hidden="true">+</b>}
              {row.label}
            </span>
            <input
              type="number"
              min="0"
              placeholder="0.00"
              value={row.amount}
              onChange={(event) =>
                onChange(row.id, "amount", event.target.value)
              }
            />
            <input
              type="number"
              min="0"
              max="100"
              placeholder="0.00"
              value={row.use}
              onChange={(event) => onChange(row.id, "use", event.target.value)}
            />
          </div>
        ))}
        <div className="logit-table-total" role="row">
          <strong>{totalLabel}</strong>
          <span>{formatMoney(totalAmount)}</span>
          <span>{formatMoney(totalUse)}</span>
        </div>
      </div>
    </section>
  );
}
