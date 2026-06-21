"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/src/lib/session";
import type { CoreEntity, EntityType } from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

type EntityTypeOption = {
  value: EntityType;
  label: string;
  description: string;
};

const entityTypeOptions: EntityTypeOption[] = [
  {
    value: "individual",
    label: "Individual",
    description: "Single person ownership with direct asset control",
  },
  {
    value: "partnership",
    label: "Partnership",
    description: "Shared ownership between two or more partners",
  },
  {
    value: "company",
    label: "Company (Pvt Ltd)",
    description: "Limited liability company structure with shareholders",
  },
  {
    value: "trust",
    label: "Trust (Discretionary/ Unit)",
    description: "Asset protection and flexible distribution to beneficiaries",
  },
  {
    value: "smsf",
    label: "Self Managed Super Fund (SMSF)",
    description: "Tax-effective retirement savings and investment vehicle",
  },
];

type BeneficiaryRow = {
  uid: string;
  id?: number;
  name: string;
  percentage: string;
};

function newBeneficiaryRow(): BeneficiaryRow {
  return {
    uid: `b_${Math.random().toString(36).slice(2, 9)}`,
    name: "",
    percentage: "",
  };
}

export type AddEntityWizardProps = {
  createdFor: string;
  backLabel: string;
  backHref: string;
  onSuccessHref: string;
  addAnotherHref?: string;
  defaultBeneficiaryName?: string;
  mode?: "create" | "edit";
  initialEntity?: CoreEntity;
};

export default function AddEntityWizard({
  createdFor,
  backLabel,
  backHref,
  onSuccessHref,
  addAnotherHref,
  defaultBeneficiaryName = "",
  mode = "create",
  initialEntity,
}: AddEntityWizardProps) {
  const router = useRouter();
  const [showHelpSidebar, setShowHelpSidebar] = useState(false);
  const [entityType, setEntityType] = useState<EntityType | null>(() => {
    if (initialEntity?.entityType === "smsf") {
      return "smsf";
    }
    if (initialEntity?.entityType === "trust") {
      const tType = (initialEntity as any).trustType || (initialEntity as any).trust_type;
      if (tType === "smsf") {
        return "smsf";
      }
    }
    return initialEntity?.entityType ?? null;
  });
  const [trustType, setTrustType] = useState<"discretionary" | "unit" | "hybrid" | null>(() => {
    if (initialEntity?.entityType === "trust") {
      const tType = (initialEntity as any).trustType || (initialEntity as any).trust_type;
      if (tType === "discretionary" || tType === "unit" || tType === "hybrid") {
        return tType;
      }
    }
    return null;
  });
  const [entityName, setEntityName] = useState(initialEntity?.name ?? "");
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryRow[]>(
    getInitialBeneficiaries(initialEntity),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedEntity, setSavedEntity] = useState<CoreEntity | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const totalOwnership = useMemo(
    () =>
      beneficiaries.reduce((sum, row) => {
        const value = Number.parseFloat(row.percentage);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0),
    [beneficiaries],
  );
  const filledBeneficiaries = useMemo(
    () =>
      beneficiaries.filter(
        (row) => row.name.trim() || row.percentage.trim(),
      ),
    [beneficiaries],
  );

  const ownershipAboveZero = totalOwnership > 0;
  const ownershipWithinLimit = totalOwnership <= 100;
  const ownershipOverLimit = totalOwnership > 100;
  const needsBeneficiaries =
    entityType === "partnership" ||
    entityType === "trust";
  const beneficiariesValid =
    !needsBeneficiaries ||
    (ownershipAboveZero &&
      ownershipWithinLimit &&
      filledBeneficiaries.length > 0 &&
      filledBeneficiaries.every((row) => {
        const percentage = Number.parseFloat(row.percentage);
        return (
          row.name.trim().length > 0 &&
          Number.isFinite(percentage) &&
          percentage > 0
        );
      }));

  const beneficiaryNoun =
    entityType === "partnership" ? "Partner" : "Beneficiary";
  const isEditMode = mode === "edit";

  const options = useMemo(() => {
    const list: {
      id: string;
      label: string;
      desc: string;
      entityType: EntityType;
      trustType: "discretionary" | "unit" | "hybrid" | null;
    }[] = [
      { id: "individual", label: "Individual", desc: "Personal", entityType: "individual", trustType: null },
      { id: "company", label: "Company", desc: "Pty Ltd", entityType: "company", trustType: null },
      { id: "partnership", label: "Partnership", desc: "Business", entityType: "partnership", trustType: null },
      { id: "smsf", label: "SMSF", desc: "Super fund", entityType: "smsf", trustType: null },
      { id: "trust_discretionary", label: "Trust", desc: "Type — Discretionary", entityType: "trust", trustType: "discretionary" },
      { id: "trust_unit", label: "Trust", desc: "Type — Unit", entityType: "trust", trustType: "unit" },
    ];
    if (entityType === "trust" && trustType === "hybrid") {
      list.push({ id: "trust_hybrid", label: "Trust", desc: "Type — Hybrid", entityType: "trust", trustType: "hybrid" });
    }
    return list;
  }, [entityType, trustType]);

  useEffect(() => {
    if (!initialEntity) return;
    if (initialEntity.entityType === "smsf") {
      setEntityType("smsf");
      setTrustType(null);
    } else if (initialEntity.entityType === "trust") {
      const tType = (initialEntity as any).trustType || (initialEntity as any).trust_type;
      if (tType === "smsf") {
        setEntityType("smsf");
        setTrustType(null);
      } else {
        setEntityType("trust");
        if (tType === "discretionary" || tType === "unit" || tType === "hybrid") {
          setTrustType(tType);
        } else {
          setTrustType("discretionary");
        }
      }
    } else {
      setEntityType(initialEntity.entityType);
      setTrustType(null);
    }
    setEntityName(initialEntity.name);
    setBeneficiaries(getInitialBeneficiaries(initialEntity));
  }, [initialEntity]);

  function updateRow(uid: string, patch: Partial<BeneficiaryRow>) {
    setBeneficiaries((current) =>
      current.map((row) => (row.uid === uid ? { ...row, ...patch } : row)),
    );
  }

  function removeRow(uid: string) {
    setBeneficiaries((current) =>
      current.length === 1 ? current : current.filter((row) => row.uid !== uid),
    );
  }

  function resetState() {
    setEntityType(null);
    setTrustType(null);
    setEntityName("");
    setBeneficiaries([newBeneficiaryRow()]);
    setSaved(false);
    setSavedEntity(null);
    setErrorMessage("");
  }

  async function submit(): Promise<CoreEntity | null> {
    setErrorMessage("");
    if (!entityType || !entityName.trim() || !beneficiariesValid) {
      setErrorMessage("Please complete every field before saving.");
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
        entity_type: entityType,
        name: entityName.trim(),
        created_for: createdFor,
      };

      if (entityType === "trust" && trustType) {
        body.trust_type = trustType;
      }

      const primaryBeneficiary = initialEntity?.beneficiaries[0];

      body.beneficiaries = needsBeneficiaries
        ? filledBeneficiaries.map((row) => ({
          ...(row.id ? { id: row.id } : {}),
          name: row.name.trim(),
          ownership_percentage: Number.parseFloat(row.percentage),
        }))
        : [
          {
            ...(primaryBeneficiary?.id ? { id: primaryBeneficiary.id } : {}),
            name:
              primaryBeneficiary?.name ||
              defaultBeneficiaryName.trim() ||
              entityName.trim(),
            ownership_percentage: 100,
          },
        ];

      const url =
        isEditMode && initialEntity
          ? `/api/entities/${encodeURIComponent(initialEntity.id)}`
          : "/api/entities";

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
          `Failed to ${isEditMode ? "update" : "save"} entity.`,
        );
        return null;
      }

      const entity = (await res.json()) as CoreEntity;
      setSavedEntity(entity);
      return entity;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSave() {
    const entity = await submit();
    if (entity) setSaved(true);
  }

  async function handleAddAnother() {
    const entity = await submit();
    if (entity) {
      resetState();
      if (addAnotherHref) router.push(addAnotherHref);
    }
  }

  return (
    <div className="entity-wizard-container">
      {/* Header section (breadcrumb, title, Confused about entity button) */}
      <div className="entity-wizard-header">
        <div className="entity-wizard-breadcrumb">
          <Link href={backHref} className="entity-wizard-breadcrumb-link">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", marginRight: "4px", verticalAlign: "middle" }}>
              <path d="M15 18l-6-6 6-6" />
            </svg>
            {backLabel}
          </Link>
          <span className="entity-wizard-breadcrumb-separator">/</span>
          <span className="entity-wizard-breadcrumb-current">
            {isEditMode ? "Edit entity" : "Create entity"}
          </span>
        </div>

        <div className="entity-wizard-title-row">
          <div className="entity-wizard-title-group">
            <h1>{isEditMode ? "Edit entity" : "Create a new entity"}</h1>
            <p>Set up the structure that will own your properties</p>
          </div>
          <button
            type="button"
            className="entity-wizard-help-trigger"
            onClick={() => setShowHelpSidebar(true)}
            aria-label="Toggle help information"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", marginRight: "6px", verticalAlign: "middle" }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            Confused about entity?
          </button>
        </div>
      </div>

      <div className="entity-wizard-layout">
        {/* Main form area */}
        <div className="entity-wizard-main">
          <div className="entity-wizard-card">
            {/* STEP 1 - ENTITY DETAILS */}
            <div className="entity-wizard-section">
              <span className="entity-wizard-section-tag">STEP 1 — ENTITY DETAILS</span>
              
              <div className="entity-wizard-field">
                <label className="entity-wizard-label" htmlFor="entityName">
                  Entity name <span className="required-asterisk">*</span>
                </label>
                <input
                  id="entityName"
                  type="text"
                  placeholder={
                    entityType === "individual"
                      ? "e.g. John Smith"
                      : entityType === "partnership"
                        ? "e.g. Smith & Brown Partnership"
                        : entityType === "company"
                          ? "e.g. ABC Properties Pty Ltd"
                          : entityType === "smsf"
                            ? "e.g. Smith Super Fund"
                            : entityType === "trust"
                              ? trustType === "hybrid"
                                ? "e.g. Smith Hybrid Trust"
                                : "e.g. Smith Family/Unit Trust"
                              : "e.g., Smith Family Trust, ABC Properties LLC"
                  }
                  value={entityName}
                  onChange={(event) => setEntityName(event.target.value)}
                  className="entity-wizard-input"
                  autoFocus
                />
              </div>

              <div className="entity-wizard-field">
                <label className="entity-wizard-label">
                  Entity type <span className="required-asterisk">*</span>
                </label>
                <div className="entity-type-grid">
                  {options.map((option) => {
                    const isSelected = entityType === option.entityType && trustType === option.trustType;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`entity-type-card${isSelected ? " is-selected" : ""}`}
                        onClick={() => {
                          setEntityType(option.entityType);
                          setTrustType(option.trustType);
                        }}
                      >
                        <strong>{option.label}</strong>
                        <span>{option.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* STEP 2 - BENEFICIARIES */}
            {needsBeneficiaries && (
              <div className="entity-wizard-section border-t border-[#eaecf0] pt-6 mt-2">
                <span className="entity-wizard-section-tag">STEP 2 — BENEFICIARIES</span>
                
                <div className="entity-beneficiary-headers">
                  <span className="beneficiary-header-name">BENEFICIARY NAME</span>
                  <span className="beneficiary-header-pct">OWNERSHIP %</span>
                  <span className="beneficiary-header-spacer" />
                </div>

                <div className="entity-beneficiary-list">
                  {beneficiaries.map((row) => (
                    <div key={row.uid} className="entity-beneficiary-row">
                      <input
                        type="text"
                        className="entity-beneficiary-name"
                        placeholder={`${beneficiaryNoun} name`}
                        value={row.name}
                        onChange={(event) =>
                          updateRow(row.uid, { name: event.target.value })
                        }
                      />
                      <div className="entity-beneficiary-pct">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          placeholder="0"
                          value={row.percentage}
                          onChange={(event) =>
                            updateRow(row.uid, { percentage: event.target.value })
                          }
                        />
                        <span>%</span>
                      </div>
                      <button
                        type="button"
                        className="entity-beneficiary-remove"
                        aria-label="Remove beneficiary"
                        onClick={() => removeRow(row.uid)}
                        disabled={beneficiaries.length === 1}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="entity-beneficiary-add"
                    onClick={() =>
                      setBeneficiaries((current) => [...current, newBeneficiaryRow()])
                    }
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", marginRight: "6px", verticalAlign: "middle" }}>
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add beneficiary
                  </button>
                </div>

                <div
                  className={`entity-beneficiary-total${ownershipAboveZero && ownershipWithinLimit ? " is-complete" : ""
                    }${ownershipOverLimit ? " is-over" : ""}`}
                >
                  <span>Total ownership</span>
                  <strong>{formatPercentage(totalOwnership)}</strong>
                </div>

                {ownershipOverLimit && (
                  <p className="entity-wizard-error">
                    Total ownership cannot exceed 100%.
                  </p>
                )}
              </div>
            )}

            {errorMessage && (
              <p className="entity-wizard-error">{errorMessage}</p>
            )}

            {/* Form Actions (Cancel / Save) */}
            <div className="entity-wizard-actions">
              <Link href={backHref} className="entity-wizard-btn-cancel">
                Cancel
              </Link>
              <div className="entity-wizard-btn-group">
                {!isEditMode && addAnotherHref && (
                  <button
                    type="button"
                    className="entity-wizard-btn-secondary"
                    disabled={!entityName.trim() || !entityType || !beneficiariesValid || isSaving}
                    onClick={handleAddAnother}
                  >
                    Add Another Entity
                  </button>
                )}
                <button
                  type="button"
                  className="entity-wizard-btn-save"
                  disabled={!entityName.trim() || !entityType || !beneficiariesValid || isSaving}
                  onClick={handleSave}
                >
                  {isSaving
                    ? "Saving..."
                    : isEditMode
                      ? "Save Changes"
                      : "Save entity"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success layer dialog */}
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
            <div className="entity-success-body">
              <strong>
                Entity Successfully {isEditMode ? "Updated" : "Added"}!
              </strong>
              <p>
                {isEditMode ? (
                  "Your entity details have been updated and are ready for property and transaction mapping."
                ) : (
                  <>
                    You&apos;ve successfully registered this entity. It&apos;s
                    now ready for property and transaction mapping.
                  </>
                )}
              </p>
            </div>
            <div className="entity-success-footer">
              <Link
                href={
                  !isEditMode && (entityType === "individual" || entityType === "smsf") && savedEntity
                    ? onSuccessHref.includes("/dashboard/accountant")
                      ? `/dashboard/accountant/clients/${createdFor}/entities/${savedEntity.id}/properties/new`
                      : `/dashboard/client/entities/${savedEntity.id}/properties/new`
                    : onSuccessHref
                }
                className="entity-wizard-btn-save"
                style={{ textAlign: "center", display: "inline-block" }}
              >
                Continue
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal Popup Overlay */}
      {showHelpSidebar && (
        <div className="entity-help-modal-layer" role="dialog" aria-modal="true">
          <div className="entity-help-modal-backdrop" onClick={() => setShowHelpSidebar(false)} />
          <div className="entity-help-modal-card">
            <button
              type="button"
              className="entity-help-modal-close-floating"
              onClick={() => setShowHelpSidebar(false)}
              aria-label="Close help modal"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            
            <div className="entity-help-card">
              <h4>What&apos;s an entity?</h4>
              <p>
                An entity is the legal structure that owns your properties — a trust, company, or yourself as an individual. You can have multiple entities, each owning different properties.
              </p>
            </div>

            <div className="entity-help-card">
              <h4>Which type should I pick?</h4>
              <div className="entity-help-list">
                <div className="entity-help-item">
                  <strong>Individual</strong> — Property owned in your name
                </div>
                <div className="entity-help-item">
                  <strong>Company</strong> — Pty Ltd that owns property
                </div>
                <div className="entity-help-item">
                  <strong>Partnership</strong> — Two or more owners
                </div>
                <div className="entity-help-item">
                  <strong>SMSF</strong> — Self-managed super fund
                </div>
                <div className="entity-help-item">
                  <strong>Trust</strong> — Discretionary or unit trust
                </div>
              </div>
              <p className="entity-help-footnote">
                Not sure? Talk to your accountant before saving.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success layer dialog (same state flow, styled with backdrop) */}
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
            <div className="entity-success-body">
              <strong>
                Entity Successfully {isEditMode ? "Updated" : "Added"}!
              </strong>
              <p>
                {isEditMode ? (
                  "Your entity details have been updated and are ready for property and transaction mapping."
                ) : (
                  <>
                    You&apos;ve successfully registered this entity. It&apos;s
                    now ready for property and transaction mapping.
                  </>
                )}
              </p>
            </div>
            <div className="entity-success-footer">
              <Link
                href={
                  !isEditMode && (entityType === "individual" || entityType === "smsf") && savedEntity
                    ? onSuccessHref.includes("/dashboard/accountant")
                      ? `/dashboard/accountant/clients/${createdFor}/entities/${savedEntity.id}/properties/new`
                      : `/dashboard/client/entities/${savedEntity.id}/properties/new`
                    : onSuccessHref
                }
                className="entity-wizard-btn-save"
                style={{ textAlign: "center", display: "inline-block" }}
              >
                Continue
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getInitialBeneficiaries(entity?: CoreEntity): BeneficiaryRow[] {
  if (!entity?.beneficiaries.length) return [newBeneficiaryRow()];

  return entity.beneficiaries.map((beneficiary) => ({
    uid: `b_${beneficiary.id ?? beneficiary.name}_${Math.random().toString(36).slice(2, 7)}`,
    id: beneficiary.id,
    name: beneficiary.name,
    percentage:
      Math.abs(
        beneficiary.ownershipPercentage -
        Math.round(beneficiary.ownershipPercentage),
      ) < 0.001
        ? String(Math.round(beneficiary.ownershipPercentage))
        : String(beneficiary.ownershipPercentage),
  }));
}

function formatPercentage(value: number) {
  if (Math.abs(value - Math.round(value)) < 0.001) {
    return `${Math.round(value)}%`;
  }
  return `${value.toFixed(1)}%`;
}
