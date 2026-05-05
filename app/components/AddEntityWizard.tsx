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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [entityType, setEntityType] = useState<EntityType | null>(
    initialEntity?.entityType ?? null,
  );
  const [entityName, setEntityName] = useState(initialEntity?.name ?? "");
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryRow[]>(
    getInitialBeneficiaries(initialEntity),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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
    entityType === "partnership" || entityType === "trust";
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

  const selectedTypeLabel =
    entityTypeOptions.find((option) => option.value === entityType)?.label ??
    "";
  const beneficiaryNoun =
    entityType === "partnership" ? "Partner" : "Beneficiary";
  const beneficiaryNounPlural =
    entityType === "partnership" ? "Partners" : "Beneficiaries";
  const isEditMode = mode === "edit";
  const stepMeta = useMemo(
    () => [
      { title: "Choose Entity Type", subtitle: "Select the type of entity" },
      { title: "Enter Entity Name", subtitle: "Name client entity" },
      ...(needsBeneficiaries
        ? [
            {
              title: `Add ${beneficiaryNounPlural}`,
              subtitle: "Define ownership structure",
            },
          ]
        : []),
    ],
    [beneficiaryNounPlural, needsBeneficiaries],
  );

  useEffect(() => {
    if (!initialEntity) return;
    setEntityType(initialEntity.entityType);
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
    setStep(1);
    setEntityType(null);
    setEntityName("");
    setBeneficiaries([newBeneficiaryRow()]);
    setSaved(false);
    setErrorMessage("");
  }

  async function submit(): Promise<CoreEntity | null> {
    setErrorMessage("");
    if (!entityType || !entityName.trim() || !beneficiariesValid) {
      setErrorMessage("Please complete every step before saving.");
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

      return (await res.json()) as CoreEntity;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSave() {
    const entity = await submit();
    if (entity) setSaved(true);
  }

  function handleNameContinue() {
    if (needsBeneficiaries) {
      setStep(3);
      return;
    }

    handleSave();
  }

  async function handleAddAnother() {
    const entity = await submit();
    if (entity) {
      resetState();
      if (addAnotherHref) router.push(addAnotherHref);
    }
  }

  return (
    <section className="entity-wizard">
      <div className="entity-wizard-top">
        <Link href={backHref} className="entity-wizard-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back to {backLabel}
        </Link>
      </div>

      <ol className="entity-wizard-steps" aria-label="Entity creation steps">
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
            <h2>Choose Entity Type</h2>
            <p>
              Select the type of entity you want to{" "}
              {isEditMode ? "maintain" : "create"}
            </p>
          </header>

          <div className="entity-type-grid">
            {entityTypeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`entity-type-card${entityType === option.value ? " is-selected" : ""}`}
                onClick={() => setEntityType(option.value)}
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>

          <div className="entity-wizard-footer">
            <div />
            <button
              type="button"
              className="entity-wizard-primary"
              disabled={!entityType}
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
            <h2>Enter Entity Name</h2>
            <p>Give client entity a clear, identifiable name</p>
          </header>

          <label className="entity-wizard-label">
            <span>
              Entity Name <em>*</em>
            </span>
            <input
              type="text"
              placeholder="e.g., Smith Family Trust, ABC Properties LLC"
              value={entityName}
              onChange={(event) => setEntityName(event.target.value)}
              autoFocus
            />
          </label>

          <div className="entity-wizard-selected-chip">
            Selected Type: <strong>{selectedTypeLabel}</strong>
          </div>

          {errorMessage && (
            <p className="entity-wizard-error">{errorMessage}</p>
          )}

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
              disabled={!entityName.trim() || isSaving}
              onClick={handleNameContinue}
            >
              {needsBeneficiaries
                ? "Continue"
                : isSaving
                  ? "Saving..."
                  : isEditMode
                    ? "Update Entity"
                    : "Create Entity"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="entity-wizard-card">
          <header>
            <h2>Add {beneficiaryNounPlural}</h2>
            <p>
              Define the {beneficiaryNoun.toLowerCase()} ownership percentages
              for this entity
            </p>
          </header>

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
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6l12 12" />
                    <path d="M18 6 6 18" />
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
              + Add Another {beneficiaryNoun}
            </button>
          </div>

          <div
            className={`entity-beneficiary-total${
              ownershipAboveZero && ownershipWithinLimit ? " is-complete" : ""
            }${ownershipOverLimit ? " is-over" : ""}`}
          >
            <span>Total Ownership:</span>
            <strong>{formatPercentage(totalOwnership)}</strong>
          </div>

          {ownershipOverLimit && (
            <p className="entity-wizard-error">
              Total ownership cannot exceed 100%.
            </p>
          )}

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
            <div className="entity-wizard-footer-actions">
              {!isEditMode && (
                <button
                  type="button"
                  className="entity-wizard-secondary"
                  disabled={!beneficiariesValid || isSaving}
                  onClick={addAnotherHref ? handleAddAnother : handleSave}
                >
                  Add Another Entity
                </button>
              )}
              <button
                type="button"
                className="entity-wizard-primary"
                disabled={!beneficiariesValid || isSaving}
                onClick={handleSave}
              >
                {isSaving
                  ? "Saving…"
                  : isEditMode
                    ? "Save Changes"
                    : "Save & Start Adding Property"}
              </button>
            </div>
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
            <div className="entity-success-body">
              <strong>
                Entity Successfully {isEditMode ? "Updated" : "Added"} !
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
              <Link href={onSuccessHref} className="entity-wizard-primary">
                Continue
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
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
