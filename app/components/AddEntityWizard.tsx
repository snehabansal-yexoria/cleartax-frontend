"use client";

import { Fragment, useMemo, useState } from "react";
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
};

const stepMeta = [
  { title: "Choose Entity Type", subtitle: "Select the type of entity" },
  { title: "Enter Entity Name", subtitle: "Name client entity" },
  { title: "Add Beneficiaries", subtitle: "Define ownership structure" },
];

export default function AddEntityWizard({
  createdFor,
  backLabel,
  backHref,
  onSuccessHref,
  addAnotherHref,
}: AddEntityWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [entityType, setEntityType] = useState<EntityType | null>(null);
  const [entityName, setEntityName] = useState("");
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryRow[]>([
    newBeneficiaryRow(),
  ]);
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

  const ownershipComplete = Math.abs(totalOwnership - 100) < 0.01;
  const beneficiariesValid =
    ownershipComplete &&
    beneficiaries.every((row) => row.name.trim().length > 0);

  const selectedTypeLabel =
    entityTypeOptions.find((option) => option.value === entityType)?.label ?? "";

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

      const res = await fetch("/api/entities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entity_type: entityType,
          name: entityName.trim(),
          created_for: createdFor,
          beneficiaries: beneficiaries.map((row) => ({
            name: row.name.trim(),
            ownership_percentage: Number.parseFloat(row.percentage),
          })),
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setErrorMessage(
          payload?.error || payload?.message || "Failed to save entity.",
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
            step === position ? "current" : step > position ? "done" : "pending";
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
            <p>Select the type of entity you want to create</p>
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
              disabled={!entityName.trim()}
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
            <h2>Add Beneficiaries</h2>
            <p>Define who benefits from this entity and their ownership percentages</p>
          </header>

          <div className="entity-beneficiary-list">
            {beneficiaries.map((row) => (
              <div key={row.uid} className="entity-beneficiary-row">
                <input
                  type="text"
                  className="entity-beneficiary-name"
                  placeholder="Beneficiary name"
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
              + Add Another Beneficiary
            </button>
          </div>

          <div
            className={`entity-beneficiary-total${ownershipComplete ? " is-complete" : ""}`}
          >
            <span>Total Ownership:</span>
            <strong>{formatPercentage(totalOwnership)}</strong>
          </div>

          {errorMessage && <p className="entity-wizard-error">{errorMessage}</p>}

          <div className="entity-wizard-footer">
            <button
              type="button"
              className="entity-wizard-link"
              onClick={() => setStep(2)}
            >
              Back
            </button>
            <div className="entity-wizard-footer-actions">
              <button
                type="button"
                className="entity-wizard-secondary"
                disabled={!beneficiariesValid || isSaving}
                onClick={addAnotherHref ? handleAddAnother : handleSave}
              >
                Add Another Entity
              </button>
              <button
                type="button"
                className="entity-wizard-primary"
                disabled={!beneficiariesValid || isSaving}
                onClick={handleSave}
              >
                {isSaving ? "Saving…" : "Save & Start Adding Property"}
              </button>
            </div>
          </div>
        </div>
      )}

      {saved && (
        <div className="entity-success-layer" role="dialog" aria-modal="true">
          <div className="entity-success-backdrop" aria-hidden="true" />
          <div className="entity-success-card">
            <span className="entity-success-eyebrow">Entity Added</span>
            <div className="entity-success-body">
              <strong>Entity Successfully Added !</strong>
              <p>
                You&apos;ve successfully registered this entity. It&apos;s now ready
                for property and transaction mapping.
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

function formatPercentage(value: number) {
  if (Math.abs(value - Math.round(value)) < 0.001) {
    return `${Math.round(value)}%`;
  }
  return `${value.toFixed(1)}%`;
}
