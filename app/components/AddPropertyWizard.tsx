"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import type { CoreEntity, CoreProperty, PropertyType } from "@/src/lib/coreApi";
import { getSession } from "@/src/lib/session";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

type PropertyTypeOption = {
  value: PropertyType;
  label: string;
};

const propertyTypeOptions: PropertyTypeOption[] = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "vacant_land", label: "Vacant Land" },
];

const propertyStatusOptions = [
  "Self Occupied",
  "Vacant",
  "Available for Rent",
  "Rented",
  "Listed for Sale",
  "Under Renovation",
];

const stepMeta = [
  { title: "Property Details", subtitle: "Basic Information" },
  { title: "Ownership Details", subtitle: "Define Ownership" },
  { title: "Loan Details", subtitle: "Optional Financing Info" },
];

type OwnerRow = {
  entityBeneficiaryId: number;
  name: string;
  percentage: string;
};

export type AddPropertyWizardProps = {
  entity: CoreEntity;
  backHref: string;
  onSuccessHref: string;
};

function titleCase(value: string) {
  if (!value) return "";
  return value
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function toMoney(value: string) {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function AddPropertyWizard({
  entity,
  backHref,
  onSuccessHref,
}: AddPropertyWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [propertyName, setPropertyName] = useState("");
  const [propertyType, setPropertyType] = useState<PropertyType>("residential");
  const [locationText, setLocationText] = useState("");
  const [estimatedMarketValue, setEstimatedMarketValue] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [hasDepreciationSchedule, setHasDepreciationSchedule] = useState(false);
  const [status, setStatus] = useState("Listed for Sale");
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [availableForRentDate, setAvailableForRentDate] = useState("");
  const [firstRentalIncomeDate, setFirstRentalIncomeDate] = useState("");
  const [renovationStartDate, setRenovationStartDate] = useState("");
  const [renovationEndDate, setRenovationEndDate] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [owners, setOwners] = useState<OwnerRow[]>(
    entity.beneficiaries
      .filter((beneficiary) => typeof beneficiary.id === "number")
      .map((beneficiary) => ({
        entityBeneficiaryId: beneficiary.id as number,
        name: beneficiary.name,
        percentage: String(beneficiary.ownershipPercentage || ""),
      })),
  );
  const [bankName, setBankName] = useState("");
  const [bsbNumber, setBsbNumber] = useState("");
  const [loanAccountNumber, setLoanAccountNumber] = useState("");
  const [loanAllocationPercentage, setLoanAllocationPercentage] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastRequestPayload, setLastRequestPayload] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [lastResponsePayload, setLastResponsePayload] = useState<Record<
    string,
    unknown
  > | null>(null);

  const totalOwnership = useMemo(
    () =>
      owners.reduce((sum, owner) => {
        const value = Number.parseFloat(owner.percentage);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0),
    [owners],
  );

  const statusDetailsValid =
    status === "Available for Rent"
      ? Boolean(availableForRentDate)
      : status === "Rented"
        ? Boolean(availableForRentDate && firstRentalIncomeDate)
        : status === "Under Renovation"
          ? Boolean(renovationStartDate)
          : true;

  const propertyDetailsValid = Boolean(
    propertyName.trim() &&
    propertyType &&
    locationText.trim() &&
    estimatedMarketValue.trim() &&
    purchaseDate &&
    purchaseAmount.trim() &&
    status.trim() &&
    statusDetailsValid,
  );

  const ownershipAboveZero = totalOwnership > 0;
  const ownershipWithinLimit = totalOwnership <= 100;
  const ownershipOverLimit = totalOwnership > 100;
  const ownersValid =
    owners.length > 0 && ownershipAboveZero && ownershipWithinLimit;

  function updateOwner(entityBeneficiaryId: number, percentage: string) {
    setOwners((current) =>
      current.map((owner) =>
        owner.entityBeneficiaryId === entityBeneficiaryId
          ? { ...owner, percentage }
          : owner,
      ),
    );
  }

  function selectStatus(nextStatus: string) {
    setStatus(nextStatus);
    setIsStatusOpen(false);
    setAvailableForRentDate("");
    setFirstRentalIncomeDate("");
    setRenovationStartDate("");
    setRenovationEndDate("");
  }

  function buildStatusDetails() {
    if (status === "Available for Rent") {
      return {
        status,
        available_for_rent_date: availableForRentDate,
      };
    }

    if (status === "Rented") {
      return {
        status,
        available_for_rent_date: availableForRentDate,
        first_rental_income_date: firstRentalIncomeDate,
      };
    }

    if (status === "Under Renovation") {
      return {
        status,
        renovation_start_date: renovationStartDate,
        ...(renovationEndDate
          ? { renovation_end_date: renovationEndDate }
          : {}),
      };
    }

    return { status };
  }

  function buildLoanDetails() {
    const details: Record<string, unknown> = {};
    if (bankName.trim()) details.bank_name = bankName.trim();
    if (bsbNumber.trim()) details.bsb_number = bsbNumber.trim();
    if (loanAccountNumber.trim()) {
      details.loan_account_number = loanAccountNumber.trim();
    }
    if (loanAllocationPercentage.trim()) {
      details.loan_allocation_percentage = Number.parseFloat(
        loanAllocationPercentage,
      );
    }
    if (loanAmount.trim()) {
      details.loan_amount = Number.parseFloat(loanAmount);
    }
    return Object.keys(details).length > 0 ? details : undefined;
  }

  async function submit(): Promise<CoreProperty | null> {
    setErrorMessage("");
    if (!propertyDetailsValid || !ownersValid) {
      setErrorMessage("Please complete the property details and ownership.");
      return null;
    }

    setIsSaving(true);
    try {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) {
        setErrorMessage("Your session has expired. Please log in again.");
        return null;
      }
      const token = session.getIdToken().getJwtToken();

      const body: Record<string, unknown> = {
        name: propertyName.trim(),
        property_type: propertyType,
        location_text: locationText.trim(),
        estimated_market_value: Number.parseFloat(estimatedMarketValue),
        purchase_date: purchaseDate,
        purchase_amount: Number.parseFloat(purchaseAmount),
        has_depreciation_schedule: hasDepreciationSchedule,
        status: status.trim(),
        owners: owners.map((owner) => ({
          entity_beneficiary_id: owner.entityBeneficiaryId,
          ownership_percentage: Number.parseFloat(owner.percentage),
        })),
      };

      if (imageUrl.trim()) body.image_url = imageUrl.trim();
      const loanDetails = {
        ...(buildLoanDetails() || {}),
        property_status_details: buildStatusDetails(),
      };
      body.loan_details = loanDetails;
      setLastRequestPayload(body);
      setLastResponsePayload(null);

      const res = await fetch(`/api/entities/${entity.id}/properties`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setLastResponsePayload(payload as Record<string, unknown>);
        setErrorMessage(
          payload?.error || payload?.message || "Failed to save property.",
        );
        return null;
      }

      const payload = (await res.json()) as CoreProperty;
      setLastResponsePayload(payload as unknown as Record<string, unknown>);
      return payload;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSave() {
    const property = await submit();
    if (property) setSaved(true);
  }

  return (
    <section className="entity-wizard property-wizard">
      <div className="entity-wizard-top">
        <Link href={backHref} className="entity-wizard-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back
        </Link>
      </div>

      <ol className="entity-wizard-steps" aria-label="Property creation steps">
        {stepMeta.map((meta, index) => {
          const position = (index + 1) as 1 | 2 | 3;
          const state =
            step === position
              ? "current"
              : step > position
                ? "done"
                : "pending";
          return (
            <Fragment key={meta.title}>
              <li className={`entity-wizard-step is-${state}`}>
                <span className="entity-wizard-step-circle" aria-hidden="true">
                  {state === "done" ? (
                    <svg viewBox="0 0 24 24">
                      <path d="M5 12l4 4 10-10" />
                    </svg>
                  ) : (
                    position
                  )}
                </span>
                <div className="entity-wizard-step-text">
                  <strong>{meta.title}</strong>
                  <span>{meta.subtitle}</span>
                </div>
              </li>
              {index < stepMeta.length - 1 && (
                <li
                  className={`entity-wizard-connector ${step > position ? "is-done" : ""}`}
                  aria-hidden="true"
                />
              )}
            </Fragment>
          );
        })}
      </ol>

      {step === 1 && (
        <div className="entity-wizard-card">
          <header>
            <h2>Property Details</h2>
            <p>Enter the basic information about the property</p>
          </header>

          <div className="entity-wizard-selected-chip property-entity-chip">
            <span>
              Entity: <strong>{entity.name}</strong>
            </span>
            <span>
              Type: <strong>{titleCase(entity.entityType)}</strong>
            </span>
          </div>

          <label className="entity-wizard-label">
            <span>
              Property Name <em>*</em>
            </span>
            <input
              type="text"
              placeholder="e.g., Sunset District Residence"
              value={propertyName}
              onChange={(event) => setPropertyName(event.target.value)}
            />
          </label>

          <div className="property-wizard-grid">
            <label className="entity-wizard-label">
              <span>
                Property Type <em>*</em>
              </span>
              <select
                value={propertyType}
                onChange={(event) =>
                  setPropertyType(event.target.value as PropertyType)
                }
              >
                {propertyTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="entity-wizard-label">
              <span>
                Property Location <em>*</em>
              </span>
              <input
                type="text"
                placeholder="Search location..."
                value={locationText}
                onChange={(event) => setLocationText(event.target.value)}
              />
            </label>

            <label className="entity-wizard-label">
              <span>
                Estimated Market Value <em>*</em>
              </span>
              <input
                type="number"
                min="0"
                placeholder="$ 0"
                value={estimatedMarketValue}
                onChange={(event) =>
                  setEstimatedMarketValue(event.target.value)
                }
              />
            </label>

            <label className="entity-wizard-label">
              <span>
                Purchase Date <em>*</em>
              </span>
              <input
                type="date"
                className="property-date-input"
                value={purchaseDate}
                onChange={(event) => setPurchaseDate(event.target.value)}
              />
            </label>

            <label className="entity-wizard-label">
              <span>
                Property Purchase Amount <em>*</em>
              </span>
              <input
                type="number"
                min="0"
                placeholder="$ 0"
                value={purchaseAmount}
                onChange={(event) => setPurchaseAmount(event.target.value)}
              />
            </label>

            <fieldset className="property-wizard-radio">
              <legend>Depreciation Schedule</legend>
              <label>
                <input
                  type="radio"
                  checked={hasDepreciationSchedule}
                  onChange={() => setHasDepreciationSchedule(true)}
                />
                Yes
              </label>
              <label>
                <input
                  type="radio"
                  checked={!hasDepreciationSchedule}
                  onChange={() => setHasDepreciationSchedule(false)}
                />
                No
              </label>
            </fieldset>
          </div>

          <div className="entity-wizard-label">
            <span id="property-status-label">
              Property Status <em>*</em>
            </span>
            <div
              className={`property-status-select${isStatusOpen ? " is-open" : ""}`}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setIsStatusOpen(false);
                }
              }}
            >
              <button
                type="button"
                className="property-status-trigger"
                aria-haspopup="listbox"
                aria-expanded={isStatusOpen}
                aria-labelledby="property-status-label"
                onClick={() => setIsStatusOpen((current) => !current)}
              >
                <span>{status}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {isStatusOpen && (
                <div className="property-status-menu" role="listbox">
                  {propertyStatusOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="option"
                      aria-selected={status === option}
                      className={status === option ? "is-selected" : ""}
                      onClick={() => selectStatus(option)}
                    >
                      <span>{option}</span>
                      {status === option && (
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

          {(status === "Available for Rent" || status === "Rented") && (
            <div className="property-status-details">
              <label className="entity-wizard-label">
                <span>
                  Available for Rent Date <em>*</em>
                </span>
                <input
                  type="date"
                  className="property-date-input"
                  value={availableForRentDate}
                  onChange={(event) =>
                    setAvailableForRentDate(event.target.value)
                  }
                />
              </label>
              {status === "Rented" && (
                <label className="entity-wizard-label">
                  <span>
                    First Rental Income Date <em>*</em>
                  </span>
                  <input
                    type="date"
                    className="property-date-input"
                    value={firstRentalIncomeDate}
                    onChange={(event) =>
                      setFirstRentalIncomeDate(event.target.value)
                    }
                  />
                </label>
              )}
            </div>
          )}

          {status === "Under Renovation" && (
            <div className="property-status-details">
              <label className="entity-wizard-label">
                <span>
                  Renovation Start Date <em>*</em>
                </span>
                <input
                  type="date"
                  className="property-date-input"
                  value={renovationStartDate}
                  onChange={(event) =>
                    setRenovationStartDate(event.target.value)
                  }
                />
              </label>
              <label className="entity-wizard-label">
                Renovation End Date <small>(Optional)</small>
                <input
                  type="date"
                  className="property-date-input"
                  value={renovationEndDate}
                  onChange={(event) => setRenovationEndDate(event.target.value)}
                />
              </label>
            </div>
          )}

          <label className="entity-wizard-label">
            Property Image URL
            <input
              type="url"
              placeholder="https://example.com/property.jpg"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
            />
          </label>

          <div className="entity-wizard-footer">
            <div />
            <button
              type="button"
              className="entity-wizard-primary"
              disabled={!propertyDetailsValid}
              onClick={() => setStep(2)}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="entity-wizard-card">
          <header>
            <h2>Ownership Details</h2>
            <p>Define who owns this property and their ownership percentages</p>
          </header>

          <div className="entity-wizard-selected-chip property-entity-chip">
            <span>
              Entity: <strong>{entity.name}</strong>
            </span>
            <span>
              Type: <strong>{titleCase(entity.entityType)}</strong>
            </span>
          </div>

          {owners.length === 0 ? (
            <p className="entity-wizard-error">
              This entity needs beneficiaries before a property can be added.
            </p>
          ) : (
            <div className="property-owner-list">
              {owners.map((owner) => (
                <div
                  key={owner.entityBeneficiaryId}
                  className="property-owner-row"
                >
                  <input value={owner.name} readOnly />
                  <div className="entity-beneficiary-pct">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={owner.percentage}
                      onChange={(event) =>
                        updateOwner(
                          owner.entityBeneficiaryId,
                          event.target.value,
                        )
                      }
                    />
                    <span>%</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            className={`entity-beneficiary-total ${
              ownershipAboveZero && ownershipWithinLimit ? "is-complete" : ""
            }${ownershipOverLimit ? " is-over" : ""}`}
          >
            <span>Total Ownership</span>
            <strong>
              {totalOwnership.toFixed(totalOwnership % 1 === 0 ? 0 : 2)}%
            </strong>
          </div>

          <div className="entity-wizard-footer">
            <button
              type="button"
              className="entity-wizard-link"
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              type="button"
              className="entity-wizard-primary"
              disabled={!ownersValid}
              onClick={() => setStep(3)}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="entity-wizard-card">
          <header>
            <h2>Loan Details</h2>
            <p>Add loan information for this property</p>
          </header>

          <label className="entity-wizard-label">
            Bank Name
            <input
              type="text"
              placeholder="e.g., Wells Fargo"
              value={bankName}
              onChange={(event) => setBankName(event.target.value)}
            />
          </label>

          <div className="property-wizard-grid">
            <label className="entity-wizard-label">
              BSB Number
              <input
                type="text"
                placeholder="e.g., 123-456"
                value={bsbNumber}
                onChange={(event) => setBsbNumber(event.target.value)}
              />
            </label>

            <label className="entity-wizard-label">
              Loan Account Number
              <input
                type="text"
                placeholder="Enter account number"
                value={loanAccountNumber}
                onChange={(event) => setLoanAccountNumber(event.target.value)}
              />
            </label>

            <label className="entity-wizard-label">
              Loan % Allocation
              <input
                type="number"
                min="0"
                max="100"
                placeholder="0%"
                value={loanAllocationPercentage}
                onChange={(event) =>
                  setLoanAllocationPercentage(event.target.value)
                }
              />
            </label>

            <label className="entity-wizard-label">
              Loan Amount
              <input
                type="number"
                min="0"
                placeholder="Enter amount"
                value={loanAmount}
                onChange={(event) => setLoanAmount(event.target.value)}
              />
            </label>
          </div>

          <div className="property-summary-card">
            <h3>Property Summary</h3>
            <dl>
              <div>
                <dt>Property Name</dt>
                <dd>{propertyName || "-"}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>
                  {
                    propertyTypeOptions.find(
                      (option) => option.value === propertyType,
                    )?.label
                  }
                </dd>
              </div>
              <div>
                <dt>Estimated Value</dt>
                <dd>{toMoney(estimatedMarketValue)}</dd>
              </div>
              <div>
                <dt>Total Owners</dt>
                <dd>{owners.length}</dd>
              </div>
            </dl>
          </div>

          {errorMessage && (
            <p className="entity-wizard-error">{errorMessage}</p>
          )}

          <div className="entity-wizard-footer">
            <button
              type="button"
              className="entity-wizard-link"
              onClick={() => setStep(2)}
            >
              Back
            </button>
            <button
              type="button"
              className="entity-wizard-primary"
              disabled={isSaving}
              onClick={handleSave}
            >
              {isSaving ? "Saving..." : "Add Property"}
            </button>
          </div>
        </div>
      )}

      {saved && (
        <div className="entity-success-layer" role="dialog" aria-modal="true">
          <div className="entity-success-backdrop" aria-hidden="true" />
          <div className="entity-success-card">
            <span className="entity-success-eyebrow">Property Added</span>
            <div className="entity-success-body">
              <strong>
                {propertyName} is now linked to {entity.name}.
              </strong>
              <p>You can view it from the entity property list.</p>
            </div>
            {/* <div className="property-payload-preview">
              <details open>
                <summary>Submitted payload</summary>
                <pre>
                  {JSON.stringify(
                    {
                      request: lastRequestPayload,
                      response: lastResponsePayload,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </div> */}
            <div className="entity-success-footer">
              <Link href={onSuccessHref} className="entity-wizard-primary">
                View Entity
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
