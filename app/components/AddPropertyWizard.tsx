"use client";

import { Fragment, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import type { CoreEntity, CoreProperty, PropertyType } from "@/src/lib/coreApi";
import { getSession } from "@/src/lib/session";
import {
  announceDropdownOpen,
  dropdownRegistryEvent,
  isDropdownRegistryEvent,
} from "@/src/lib/dropdownRegistry";

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

type PropertyStep = 1 | 2 | 3;

const allStepMeta: { step: PropertyStep; title: string; subtitle: string }[] = [
  { step: 1, title: "Property Details", subtitle: "Basic Information" },
  { step: 2, title: "Ownership Details", subtitle: "Define Ownership" },
  { step: 3, title: "Loan Details", subtitle: "Optional Financing Info" },
];

type OwnerRow = {
  id?: number;
  entityBeneficiaryId: number;
  name: string;
  percentage: string;
};

type UploadedDocumentRef = {
  documentId: string;
  s3Key: string;
  filename: string;
};

export type AddPropertyWizardProps = {
  entity: CoreEntity;
  backHref: string;
  onSuccessHref: string;
  mode?: "create" | "edit";
  initialProperty?: CoreProperty;
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

function toInputNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "";
}

function getLoanDetail(
  property: CoreProperty | undefined,
  key: string,
) {
  const value = property?.loanDetails?.[key];
  return value == null ? "" : String(value);
}

function getStatusDetails(property: CoreProperty | undefined) {
  const value = property?.loanDetails?.property_status_details;
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getStatusDetail(
  property: CoreProperty | undefined,
  key: string,
) {
  const value = getStatusDetails(property)[key];
  return value == null ? "" : String(value);
}

function getUploadedDocument(
  property: CoreProperty | undefined,
): UploadedDocumentRef | null {
  const loanDetails = property?.loanDetails;
  if (!loanDetails) return null;
  const documentId = String(
    loanDetails.depreciation_schedule_document_id ??
      loanDetails.depreciationScheduleDocumentId ??
      "",
  );
  const s3Key = String(
    loanDetails.depreciation_schedule_s3_key ??
      loanDetails.depreciationScheduleS3Key ??
      "",
  );
  const filename = String(
    loanDetails.depreciation_schedule_filename ??
      loanDetails.depreciationScheduleFilename ??
      "",
  );
  if (!documentId && !s3Key) return null;
  return { documentId, s3Key, filename };
}

async function uploadViaPresign({
  token,
  file,
  onProgress,
}: {
  token: string;
  file: File;
  onProgress?: (progress: number) => void;
}) {
  onProgress?.(5);
  const presignRes = await fetch(
    `/api/documents/presign?filename=${encodeURIComponent(file.name)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!presignRes.ok) {
    const payload = await presignRes.json().catch(() => ({}));
    throw new Error(
      payload?.message ||
        payload?.error ||
        `Failed to prepare upload (${presignRes.status}).`,
    );
  }
  const { upload_url, s3_key, document_id } = (await presignRes.json()) as {
    upload_url: string;
    s3_key: string;
    document_id: string;
  };

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", upload_url);
    request.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.min(98, Math.round((event.loaded / event.total) * 100)));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`Upload failed (${request.status}).`));
      }
    };
    request.onerror = () => reject(new Error("Upload failed."));
    request.send(file);
  });

  return { documentId: document_id, s3Key: s3_key, filename: file.name };
}

function getInitialOwners(
  entity: CoreEntity,
  initialProperty: CoreProperty | undefined,
) {
  return entity.beneficiaries
    .filter((beneficiary) => typeof beneficiary.id === "number")
    .map((beneficiary) => {
      const savedOwner = initialProperty?.owners.find(
        (owner) => owner.entityBeneficiaryId === beneficiary.id,
      );

      return {
        id: savedOwner?.id,
        entityBeneficiaryId: beneficiary.id as number,
        name: savedOwner?.ownerName || beneficiary.name,
        percentage: String(
          savedOwner?.ownershipPercentage ??
            beneficiary.ownershipPercentage ??
            "",
        ),
      };
    });
}

export default function AddPropertyWizard({
  entity,
  backHref,
  onSuccessHref,
  mode = "create",
  initialProperty,
}: AddPropertyWizardProps) {
  const propertyTypeDropdownId = `property-type-${useId()}`;
  const statusDropdownId = `property-status-${useId()}`;
  const [step, setStep] = useState<PropertyStep>(1);
  const [propertyName, setPropertyName] = useState(initialProperty?.name ?? "");
  const [propertyType, setPropertyType] = useState<PropertyType>(
    initialProperty?.propertyType ?? "residential",
  );
  const [locationText, setLocationText] = useState(
    initialProperty?.locationText ?? "",
  );
  const [estimatedMarketValue, setEstimatedMarketValue] = useState(
    toInputNumber(initialProperty?.estimatedMarketValue),
  );
  const [purchaseDate, setPurchaseDate] = useState(
    initialProperty?.purchaseDate ?? "",
  );
  const [purchaseAmount, setPurchaseAmount] = useState(
    toInputNumber(initialProperty?.purchaseAmount),
  );
  const [hasDepreciationSchedule, setHasDepreciationSchedule] = useState(
    initialProperty?.hasDepreciationSchedule ?? false,
  );
  const [status, setStatus] = useState(
    initialProperty?.status || "Listed for Sale",
  );
  const [isPropertyTypeOpen, setIsPropertyTypeOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [availableForRentDate, setAvailableForRentDate] = useState(
    getStatusDetail(initialProperty, "available_for_rent_date"),
  );
  const [firstRentalIncomeDate, setFirstRentalIncomeDate] = useState(
    getStatusDetail(initialProperty, "first_rental_income_date"),
  );
  const [renovationStartDate, setRenovationStartDate] = useState(
    getStatusDetail(initialProperty, "renovation_start_date"),
  );
  const [renovationEndDate, setRenovationEndDate] = useState(
    getStatusDetail(initialProperty, "renovation_end_date"),
  );
  const [imageUrl, setImageUrl] = useState(initialProperty?.imageUrl ?? "");
  const [propertyImageName, setPropertyImageName] = useState("");
  const [propertyImageProgress, setPropertyImageProgress] = useState(0);
  const [isUploadingPropertyImage, setIsUploadingPropertyImage] =
    useState(false);
  const [depreciationScheduleDocument, setDepreciationScheduleDocument] =
    useState<UploadedDocumentRef | null>(getUploadedDocument(initialProperty));
  const [depreciationUploadProgress, setDepreciationUploadProgress] =
    useState(0);
  const [isUploadingDepreciationSchedule, setIsUploadingDepreciationSchedule] =
    useState(false);
  const [owners, setOwners] = useState<OwnerRow[]>(
    getInitialOwners(entity, initialProperty),
  );
  const [bankName, setBankName] = useState(
    getLoanDetail(initialProperty, "bank_name"),
  );
  const [bsbNumber, setBsbNumber] = useState(
    getLoanDetail(initialProperty, "bsb_number"),
  );
  const [loanAccountNumber, setLoanAccountNumber] = useState(
    getLoanDetail(initialProperty, "loan_account_number"),
  );
  const [loanAllocationPercentage, setLoanAllocationPercentage] = useState(
    getLoanDetail(initialProperty, "loan_allocation_percentage"),
  );
  const [loanAmount, setLoanAmount] = useState(
    getLoanDetail(initialProperty, "loan_amount"),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isEditMode = mode === "edit";
  const takesOwnershipDetails = entity.entityType === "individual";
  const stepMeta = useMemo(
    () =>
      allStepMeta.filter(
        (meta) => takesOwnershipDetails || meta.step !== 2,
      ),
    [takesOwnershipDetails],
  );

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
    !takesOwnershipDetails ||
    (owners.length > 0 && ownershipAboveZero && ownershipWithinLimit);

  useEffect(() => {
    function closeIfAnotherOpened(event: Event) {
      if (!isDropdownRegistryEvent(event)) return;
      const id = event.detail?.id;
      if (!id) return;
      if (id !== propertyTypeDropdownId) setIsPropertyTypeOpen(false);
      if (id !== statusDropdownId) setIsStatusOpen(false);
    }

    window.addEventListener(dropdownRegistryEvent, closeIfAnotherOpened);
    return () =>
      window.removeEventListener(dropdownRegistryEvent, closeIfAnotherOpened);
  }, [propertyTypeDropdownId, statusDropdownId]);

  useEffect(() => {
    if (!initialProperty) {
      setOwners(getInitialOwners(entity, undefined));
      return;
    }

    setPropertyName(initialProperty.name);
    setPropertyType(initialProperty.propertyType);
    setLocationText(initialProperty.locationText);
    setEstimatedMarketValue(toInputNumber(initialProperty.estimatedMarketValue));
    setPurchaseDate(initialProperty.purchaseDate);
    setPurchaseAmount(toInputNumber(initialProperty.purchaseAmount));
    setHasDepreciationSchedule(initialProperty.hasDepreciationSchedule);
    setStatus(initialProperty.status || "Listed for Sale");
    setAvailableForRentDate(
      getStatusDetail(initialProperty, "available_for_rent_date"),
    );
    setFirstRentalIncomeDate(
      getStatusDetail(initialProperty, "first_rental_income_date"),
    );
    setRenovationStartDate(
      getStatusDetail(initialProperty, "renovation_start_date"),
    );
    setRenovationEndDate(
      getStatusDetail(initialProperty, "renovation_end_date"),
    );
    setImageUrl(initialProperty.imageUrl ?? "");
    setPropertyImageName("");
    setPropertyImageProgress(0);
    setDepreciationScheduleDocument(getUploadedDocument(initialProperty));
    setDepreciationUploadProgress(0);
    setOwners(getInitialOwners(entity, initialProperty));
    setBankName(getLoanDetail(initialProperty, "bank_name"));
    setBsbNumber(getLoanDetail(initialProperty, "bsb_number"));
    setLoanAccountNumber(getLoanDetail(initialProperty, "loan_account_number"));
    setLoanAllocationPercentage(
      getLoanDetail(initialProperty, "loan_allocation_percentage"),
    );
    setLoanAmount(getLoanDetail(initialProperty, "loan_amount"));
  }, [entity, initialProperty]);

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

  function selectPropertyType(nextType: PropertyType) {
    setPropertyType(nextType);
    setIsPropertyTypeOpen(false);
  }

  async function handlePropertyImageUpload(file: File | undefined) {
    if (!file || isUploadingPropertyImage) return;
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please upload an image file for the property image.");
      return;
    }

    setErrorMessage("");
    setIsUploadingPropertyImage(true);
    setPropertyImageName(file.name);
    try {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) {
        setErrorMessage("Your session has expired. Please log in again.");
        return;
      }
      const token = session.getIdToken().getJwtToken();
      const uploaded = await uploadViaPresign({
        token,
        file,
        onProgress: setPropertyImageProgress,
      });
      setImageUrl(uploaded.s3Key);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to upload property image.",
      );
      setPropertyImageProgress(0);
    } finally {
      setIsUploadingPropertyImage(false);
    }
  }

  async function handleDepreciationScheduleUpload(file: File | undefined) {
    if (!file || isUploadingDepreciationSchedule) return;
    setErrorMessage("");
    setIsUploadingDepreciationSchedule(true);
    try {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) {
        setErrorMessage("Your session has expired. Please log in again.");
        return;
      }
      const token = session.getIdToken().getJwtToken();
      const uploaded = await uploadViaPresign({
        token,
        file,
        onProgress: setDepreciationUploadProgress,
      });
      setDepreciationScheduleDocument(uploaded);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to upload depreciation schedule.",
      );
      setDepreciationUploadProgress(0);
    } finally {
      setIsUploadingDepreciationSchedule(false);
    }
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
      };

      if (takesOwnershipDetails) {
        body.owners = owners.map((owner) => ({
          ...(owner.id ? { id: owner.id } : {}),
          entity_beneficiary_id: owner.entityBeneficiaryId,
          ownership_percentage: Number.parseFloat(owner.percentage),
        }));
      }

      if (imageUrl.trim()) body.image_url = imageUrl.trim();
      const loanDetails = {
        ...(buildLoanDetails() || {}),
        property_status_details: buildStatusDetails(),
        ...(depreciationScheduleDocument
          ? {
              depreciation_schedule_document_id:
                depreciationScheduleDocument.documentId,
              depreciation_schedule_s3_key: depreciationScheduleDocument.s3Key,
              depreciation_schedule_filename:
                depreciationScheduleDocument.filename,
            }
          : {}),
      };
      body.loan_details = loanDetails;

      const url =
        isEditMode && initialProperty
          ? `/api/properties/${encodeURIComponent(initialProperty.id)}`
          : `/api/entities/${entity.id}/properties`;

      const res = await fetch(url, {
        method: isEditMode ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setErrorMessage(
          payload?.error ||
            payload?.message ||
            `Failed to ${isEditMode ? "update" : "save"} property.`,
        );
        return null;
      }

      const payload = (await res.json()) as CoreProperty;
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
          const state =
            step === meta.step
              ? "current"
              : step > meta.step
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
                    index + 1
                  )}
                </span>
                <div className="entity-wizard-step-text">
                  <strong>{meta.title}</strong>
                  <span>{meta.subtitle}</span>
                </div>
              </li>
              {index < stepMeta.length - 1 && (
                <li
                  className={`entity-wizard-connector ${step > meta.step ? "is-done" : ""}`}
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
            <div className="entity-wizard-label">
              <span id="property-type-label">
                Property Type <em>*</em>
              </span>
              <div
                className={`property-status-select${
                  isPropertyTypeOpen ? " is-open" : ""
                }`}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setIsPropertyTypeOpen(false);
                  }
                }}
              >
                <button
                  type="button"
                  className="property-status-trigger"
                  aria-haspopup="listbox"
                  aria-expanded={isPropertyTypeOpen}
                  aria-labelledby="property-type-label"
                  onClick={() =>
                    setIsPropertyTypeOpen((current) => {
                      const next = !current;
                      if (next) announceDropdownOpen(propertyTypeDropdownId);
                      return next;
                    })
                  }
                >
                  <span>
                    {
                      propertyTypeOptions.find(
                        (option) => option.value === propertyType,
                      )?.label
                    }
                  </span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {isPropertyTypeOpen && (
                  <div className="property-status-menu" role="listbox">
                    {propertyTypeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={propertyType === option.value}
                        className={
                          propertyType === option.value ? "is-selected" : ""
                        }
                        onClick={() => selectPropertyType(option.value)}
                      >
                        <span>{option.label}</span>
                        {propertyType === option.value && (
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
                  onChange={() => {
                    setHasDepreciationSchedule(false);
                    setDepreciationScheduleDocument(null);
                    setDepreciationUploadProgress(0);
                  }}
                />
                No
              </label>
            </fieldset>
          </div>

          {hasDepreciationSchedule && (
            <div className="property-upload-card">
              <div>
                <strong>Depreciation Schedule</strong>
                <span>
                  {depreciationScheduleDocument?.filename ||
                    "Upload the supporting schedule document"}
                </span>
              </div>
              <label className="property-upload-button">
                {isUploadingDepreciationSchedule
                  ? `${depreciationUploadProgress}%`
                  : depreciationScheduleDocument
                    ? "Replace"
                    : "Upload"}
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  disabled={isUploadingDepreciationSchedule}
                  onChange={(event) => {
                    handleDepreciationScheduleUpload(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          )}

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
                onClick={() =>
                  setIsStatusOpen((current) => {
                    const next = !current;
                    if (next) announceDropdownOpen(statusDropdownId);
                    return next;
                  })
                }
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

          <div className="property-upload-card">
            <div>
              <strong>Property Image</strong>
              <span>
                {propertyImageName ||
                  (imageUrl ? "Image uploaded" : "Upload a property image")}
              </span>
            </div>
            <label className="property-upload-button">
              {isUploadingPropertyImage
                ? `${propertyImageProgress}%`
                : imageUrl
                  ? "Replace"
                  : "Upload"}
              <input
                type="file"
                accept="image/*"
                disabled={isUploadingPropertyImage}
                onChange={(event) => {
                  handlePropertyImageUpload(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
          </div>

          <div className="entity-wizard-footer">
            <div />
            <button
              type="button"
              className="entity-wizard-primary"
              disabled={
                !propertyDetailsValid ||
                isUploadingPropertyImage ||
                isUploadingDepreciationSchedule
              }
              onClick={() => setStep(takesOwnershipDetails ? 2 : 3)}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {takesOwnershipDetails && step === 2 && (
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
                <dd>
                  {takesOwnershipDetails ? owners.length : "Entity owns 100%"}
                </dd>
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
              onClick={() => setStep(takesOwnershipDetails ? 2 : 1)}
            >
              Back
            </button>
            <button
              type="button"
              className="entity-wizard-primary"
              disabled={
                isSaving ||
                isUploadingPropertyImage ||
                isUploadingDepreciationSchedule
              }
              onClick={handleSave}
            >
              {isSaving
                ? "Saving..."
                : isEditMode
                  ? "Save Changes"
                  : "Add Property"}
            </button>
          </div>
        </div>
      )}

      {saved && (
        <div className="entity-success-layer" role="dialog" aria-modal="true">
          <div className="entity-success-backdrop" aria-hidden="true" />
          <div className="entity-success-card">
            <div className="entity-success-animation" aria-hidden="true">
              <span className="entity-success-confetti is-one" />
              <span className="entity-success-confetti is-two" />
              <span className="entity-success-confetti is-three" />
              <span className="entity-success-confetti is-four" />
              <svg viewBox="0 0 72 72">
                <circle
                  className="entity-success-badge"
                  cx="36"
                  cy="36"
                  r="28"
                />
                <path
                  className="entity-success-check"
                  d="M22 37.5 31.5 47 51 25"
                />
              </svg>
            </div>
            <span className="entity-success-body">
              Property {isEditMode ? "Updated" : "Added"}
            </span>
            <div className="entity-success-body">
              <strong>
                {isEditMode
                  ? `${propertyName} has been updated.`
                  : `${propertyName} is now linked to ${entity.name}.`}
              </strong>
              <p>
                {isEditMode
                  ? "Your property details are ready for transaction mapping."
                  : "You can view it from the entity property list."}
              </p>
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
