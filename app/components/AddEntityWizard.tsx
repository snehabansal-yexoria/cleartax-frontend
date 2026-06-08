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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [step, setStep] = useState<1 | 2 | 3>(1);
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

  const selectedTypeLabel = useMemo(() => {
    if (entityType === "trust") {
      const subLabel =
        trustType === "unit"
          ? "Unit Trust"
          : trustType === "discretionary"
            ? "Discretionary Trust"
            : trustType === "hybrid"
              ? "Hybrid Trust"
              : "";
      return subLabel ? `Trust (${subLabel})` : "Trust";
    }
    return (
      entityTypeOptions.find((option) => option.value === entityType)?.label ??
      ""
    );
  }, [entityType, trustType]);

  const beneficiaryNoun =
    entityType === "partnership" ? "Partner" : "Beneficiary";
  const beneficiaryNounPlural =
    entityType === "partnership" ? "Partners" : "Beneficiaries";
  const isEditMode = mode === "edit";
  const stepMeta = useMemo(
    () => [
      { title: "Choose Entity Type", subtitle: "Select the entity that legally owns the investment property" },
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
    setStep(1);
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

  if (isMobile) {
    return (
      <div className="m-wizard-container">
        <style>{`
          .m-wizard-container {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            background-color: #f7f9fc;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            position: relative;
          }
          .m-wizard-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            background: #ffffff;
            border-bottom: 1px solid #eaeef4;
            position: relative;
          }
          .m-wizard-back-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #1b235a;
            font-weight: 600;
            font-size: 15px;
            text-decoration: none;
            border: none;
            background: none;
            padding: 0;
            cursor: pointer;
          }
          .m-wizard-back-btn svg {
            width: 18px;
            height: 18px;
            stroke: currentColor;
            stroke-width: 2.5;
            fill: none;
          }
          .m-wizard-title {
            font-size: 18px;
            font-weight: 700;
            color: #101828;
            margin: 0;
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
          }
          .m-wizard-banner {
            background-color: #f4f6fc;
            padding: 12px 20px;
            text-align: center;
            border-bottom: 1px solid #eaeef4;
          }
          .m-wizard-banner-text {
            color: #2f3e8b;
            font-size: 14px;
            font-weight: 600;
            margin: 0;
          }
          .m-wizard-content {
            flex: 1;
            padding: 24px 20px 100px;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .m-wizard-label {
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-size: 15px;
            font-weight: 700;
            color: #101828;
          }
          .m-wizard-label em {
            color: #d92d20;
            font-style: normal;
            font-weight: 600;
            margin-left: 2px;
          }
          .m-wizard-input {
            width: 100%;
            padding: 14px 16px;
            border-radius: 12px;
            border: 1px solid #d0d5dd;
            font-size: 15px;
            color: #101828;
            background: #ffffff;
            outline: none;
            transition: border-color 0.15s ease, box-shadow 0.15s ease;
          }
          .m-wizard-input::placeholder {
            color: #98a2b3;
          }
          .m-wizard-input:focus {
            border-color: #1b235a;
            box-shadow: 0 0 0 3px rgba(27, 35, 90, 0.12);
          }
          .m-wizard-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }
          .m-wizard-card {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
            padding: 16px;
            border-radius: 12px;
            border: 1px solid #eaeef4;
            background: #ffffff;
            cursor: pointer;
            text-align: left;
            transition: border-color 0.15s ease, background-color 0.15s ease;
            width: 100%;
          }
          .m-wizard-card strong {
            font-size: 15px;
            font-weight: 700;
            color: #101828;
          }
          .m-wizard-card span {
            font-size: 13px;
            color: #667085;
            font-weight: 500;
          }
          .m-wizard-card.is-selected {
            border-color: #1b235a;
            background-color: #f4f6fc;
            box-shadow: 0 0 0 1px #1b235a;
          }
          .m-wizard-next-btn {
            align-self: flex-end;
            padding: 10px 24px;
            border-radius: 8px;
            background: #1b235a;
            color: #ffffff;
            font-size: 14px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            transition: background-color 0.15s ease;
            margin-top: 16px;
          }
          .m-wizard-next-btn:disabled {
            background-color: #c0c6d6;
            cursor: not-allowed;
          }
          .m-wizard-btn-secondary-inline {
            align-self: center;
            padding: 10px 20px;
            background: transparent;
            color: #1b235a;
            font-size: 14px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            text-decoration: underline;
          }
          .m-wizard-btn-secondary-inline:disabled {
            color: #c0c6d6;
            cursor: not-allowed;
          }
          .m-wizard-beneficiaries {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .m-beneficiary-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 100px 36px;
            gap: 8px;
            align-items: center;
          }
          .m-beneficiary-pct-wrap {
            display: flex;
            align-items: center;
            border: 1px solid #d0d5dd;
            border-radius: 12px;
            background: #ffffff;
            padding-right: 12px;
          }
          .m-beneficiary-pct-wrap input {
            border: none;
            padding: 14px 12px;
            width: 100%;
            font-size: 15px;
            outline: none;
            border-radius: 12px;
          }
          .m-beneficiary-pct-wrap span {
            font-size: 15px;
            color: #667085;
            font-weight: 600;
          }
          .m-beneficiary-remove-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #fef3f2;
            border: none;
            color: #d92d20;
            cursor: pointer;
          }
          .m-beneficiary-remove-btn:disabled {
            background: #f2f4f7;
            color: #d0d5dd;
            cursor: not-allowed;
          }
          .m-beneficiary-add-btn {
            background: none;
            border: none;
            color: #1b235a;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            margin-top: 8px;
            align-self: flex-start;
          }
          .m-wizard-error {
            color: #d92d20;
            font-size: 14px;
            margin: 0;
            font-weight: 500;
          }
        `}</style>

        {/* Header */}
        <header className="m-wizard-header">
          {step === 1 ? (
            <Link href={backHref} className="m-wizard-back-btn">
              <svg viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
          ) : (
            <button
              type="button"
              className="m-wizard-back-btn"
              onClick={() => setStep((prev) => (prev === 3 ? 2 : 1) as 1 | 2)}
            >
              <svg viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          )}
          <h1 className="m-wizard-title">
            {step === 1
              ? "Choose Entity Type"
              : step === 2
                ? "Enter Entity Name"
                : `Add ${beneficiaryNounPlural}`}
          </h1>
          <div style={{ width: '40px' }} />
        </header>

        {/* Banner */}
        <div className="m-wizard-banner">
          <p className="m-wizard-banner-text">
            Enter the below values to complete the step
          </p>
        </div>

        {/* Content area */}
        <div className="m-wizard-content">
          {step === 1 && (
            <>
              {/* Entity Type */}
              <div className="m-wizard-label">
                <span>
                  Entity Type <em>*</em>
                </span>
                <div className="m-wizard-grid">
                  {[
                    {
                      value: "individual" as EntityType,
                      label: "Individual",
                      subtext: "Personal",
                    },
                    {
                      value: "company" as EntityType,
                      label: "Company",
                      subtext: "Pty Ltd",
                    },
                    {
                      value: "partnership" as EntityType,
                      label: "Partnership",
                      subtext: "Business",
                    },
                    {
                      value: "smsf" as EntityType,
                      label: "SMSF",
                      subtext: "Super Fund",
                    },
                    {
                      value: "trust" as EntityType,
                      label: "Trust",
                      subtext: "Discretionary / Unit / Hybrid",
                    },
                  ].map((option) => {
                    const isSelected = entityType === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`m-wizard-card${isSelected ? " is-selected" : ""}`}
                        onClick={() => {
                          setEntityType(option.value);
                          if (option.value !== "trust") {
                            setTrustType(null);
                            setStep(2);
                          }
                        }}
                      >
                        <strong>{option.label}</strong>
                        <span>{option.subtext}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {entityType === "trust" && (
                <div className="m-wizard-label" style={{ marginTop: '12px' }}>
                  <span>
                    Select Trust Type <em>*</em>
                  </span>
                  <div className="m-wizard-grid">
                    {[
                      {
                        value: "discretionary" as const,
                        label: "Discretionary Trust",
                        subtext: "Type - Discretionary",
                      },
                      {
                        value: "unit" as const,
                        label: "Unit Trust",
                        subtext: "Type - Unit",
                      },
                      {
                        value: "hybrid" as const,
                        label: "Hybrid Trust",
                        subtext: "Type - Hybrid",
                      },
                    ].map((subOption) => {
                      const isSubSelected = trustType === subOption.value;
                      return (
                        <button
                          key={subOption.value}
                          type="button"
                          className={`m-wizard-card${isSubSelected ? " is-selected" : ""}`}
                          onClick={() => {
                            setTrustType(subOption.value);
                            setStep(2);
                          }}
                        >
                          <strong>{subOption.label}</strong>
                          <span>{subOption.subtext}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Next Button */}
              <button
                type="button"
                className="m-wizard-next-btn"
                disabled={!entityType || (entityType === "trust" && !trustType)}
                onClick={() => setStep(2)}
              >
                Next
              </button>
            </>
          )}

          {step === 2 && (
            <>
              {/* Entity Name */}
              <label className="m-wizard-label">
                <span>
                  Entity Name <em>*</em>
                </span>
                <input
                  type="text"
                  className="m-wizard-input"
                  placeholder="e.g., Smith Family Trust, ABC Properties LLC"
                  value={entityName}
                  onChange={(event) => setEntityName(event.target.value)}
                  autoFocus
                />
              </label>

              {/* Selected Type Display */}
              <div className="entity-wizard-selected-chip" style={{ borderRadius: '12px' }}>
                Selected Type: <strong>{selectedTypeLabel}</strong>
              </div>

              {errorMessage && <p className="m-wizard-error">{errorMessage}</p>}

              {/* Next Button */}
              <button
                type="button"
                className="m-wizard-next-btn"
                disabled={!entityName.trim() || isSaving}
                onClick={handleNameContinue}
              >
                {needsBeneficiaries
                  ? "Continue"
                  : isSaving
                    ? "Saving..."
                    : isEditMode
                      ? "Save Changes"
                      : "Create Entity"}
              </button>
            </>
          )}

          {step === 3 && (
            <>
              {/* Step 3: Beneficiaries */}
              <div className="m-wizard-label">
                <span>
                  Define the {beneficiaryNoun.toLowerCase()} ownership percentages
                  for this entity
                </span>
              </div>

              <div className="m-wizard-beneficiaries">
                {beneficiaries.map((row) => (
                  <div key={row.uid} className="m-beneficiary-row">
                    <input
                      type="text"
                      className="m-wizard-input"
                      placeholder={`${beneficiaryNoun} name`}
                      value={row.name}
                      onChange={(event) =>
                        updateRow(row.uid, { name: event.target.value })
                      }
                    />
                    <div className="m-beneficiary-pct-wrap">
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
                      className="m-beneficiary-remove-btn"
                      aria-label="Remove beneficiary"
                      onClick={() => removeRow(row.uid)}
                      disabled={beneficiaries.length === 1}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        style={{
                          width: '16px',
                          height: '16px',
                          stroke: 'currentColor',
                          strokeWidth: 2.5,
                          fill: 'none',
                        }}
                      >
                        <path d="M6 6l12 12" />
                        <path d="M18 6 6 18" />
                      </svg>
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  className="m-beneficiary-add-btn"
                  onClick={() =>
                    setBeneficiaries((current) => [
                      ...current,
                      newBeneficiaryRow(),
                    ])
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    style={{
                      width: '16px',
                      height: '16px',
                      stroke: 'currentColor',
                      strokeWidth: 2.5,
                      fill: 'none',
                    }}
                  >
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                  Add Another {beneficiaryNoun}
                </button>
              </div>

              {/* Total ownership card */}
              <div
                className={`entity-beneficiary-total${
                  ownershipAboveZero && ownershipWithinLimit ? " is-complete" : ""
                }${ownershipOverLimit ? " is-over" : ""}`}
                style={{ borderRadius: '12px', padding: '14px 16px' }}
              >
                <span>Total Ownership:</span>
                <strong>{formatPercentage(totalOwnership)}</strong>
              </div>

              {ownershipOverLimit && (
                <p className="m-wizard-error">
                  Total ownership cannot exceed 100%.
                </p>
              )}

              {errorMessage && <p className="m-wizard-error">{errorMessage}</p>}

              {/* Actions Wrapper */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '16px' }}>
                {!isEditMode && (
                  <button
                    type="button"
                    className="m-wizard-btn-secondary-inline"
                    disabled={!beneficiariesValid || isSaving}
                    onClick={addAnotherHref ? handleAddAnother : handleSave}
                  >
                    Add Another Entity
                  </button>
                )}
                <button
                  type="button"
                  className="m-wizard-next-btn"
                  disabled={!beneficiariesValid || isSaving}
                  onClick={handleSave}
                  style={{ marginTop: 0 }}
                >
                  {isSaving
                    ? "Saving…"
                    : isEditMode
                      ? "Save Changes"
                      : "Save & Start Adding Property"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Success Modal overlay (reused from original desktop code but will render fine) */}
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
                <Link
                  href={
                    !isEditMode &&
                    (entityType === "individual" || entityType === "smsf") &&
                    savedEntity
                      ? onSuccessHref.includes("/dashboard/accountant")
                        ? `/dashboard/accountant/clients/${createdFor}/entities/${savedEntity.id}/properties/new`
                        : `/dashboard/client/entities/${savedEntity.id}/properties/new`
                      : onSuccessHref
                  }
                  className="entity-wizard-primary"
                  style={{ borderRadius: '12px', width: '100%' }}
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
                onClick={() => {
                  setEntityType(option.value);
                  if (option.value !== "trust") {
                    setTrustType(null);
                  }
                }}
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>

          {entityType === "trust" && (
            <div className="entity-subtype-section" style={{ marginTop: "8px" }}>
              <h3 style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--primary, #28336e)",
                marginBottom: "12px",
                marginTop: "16px"
              }}>
                Select Trust Type:
              </h3>
              <div className="entity-type-grid">
                {[
                  {
                    value: "discretionary",
                    label: "Discretionary Trust",
                    description: "Trustee has discretion over distributions to beneficiaries",
                  },
                  {
                    value: "unit",
                    label: "Unit Trust",
                    description: "Beneficiaries hold fixed units with defined entitlements",
                  },
                  {
                    value: "hybrid",
                    label: "Hybrid Trust",
                    description: "Combines features of both discretionary and unit trusts",
                  },
                ].map((subOption) => (
                  <button
                    key={subOption.value}
                    type="button"
                    className={`entity-type-card${trustType === subOption.value ? " is-selected" : ""}`}
                    onClick={() => setTrustType(subOption.value as any)}
                  >
                    <strong>
                      {(
                        subOption.label
                      )}
                    </strong>
                    <span>{subOption.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="entity-wizard-footer">
            <div />
            <button
              type="button"
              className="entity-wizard-primary"
              disabled={!entityType || (entityType === "trust" && !trustType)}
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
            <h2>
              {entityType === "individual"
                ? "Individual"
                : entityType === "partnership"
                  ? "Partnership"
                  : entityType === "company"
                    ? "Company (Pvt Ltd)"
                    : entityType === "smsf"
                      ? "Self Managed Super Fund (SMSF)"
                      : entityType === "trust"
                        ? trustType === "unit"
                          ? "Unit Trust"
                          : trustType === "hybrid"
                            ? "Hybrid Trust"
                            : "Discretionary Trust"
                        : "Enter Entity Name"}
            </h2>
            <p>
              {entityType === "individual"
                ? "Enter the full legal name of the individual"
                : entityType === "partnership"
                  ? "Enter the partnership name as per the partnership agreement"
                  : entityType === "company"
                    ? "Enter the company name as per the ASIC registration"
                    : entityType === "smsf"
                      ? "Enter the fund name as per the SMSF deed"
                      : entityType === "trust"
                        ? trustType === "unit"
                          ? "Enter the full trust name as per the unit trust deed"
                          : trustType === "hybrid"
                            ? "Enter the full hybrid trust name as per the hybrid trust deed"
                            : "Enter the full discretionary trust name as per the trust deed"
                        : "Give client entity a clear, identifiable name"}
            </p>
          </header>

          <label className="entity-wizard-label">
            <span>
              Entity Name <em>*</em>
            </span>
            <input
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
            className={`entity-beneficiary-total${ownershipAboveZero && ownershipWithinLimit ? " is-complete" : ""
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
              <Link
                href={
                  !isEditMode && (entityType === "individual" || entityType === "smsf") && savedEntity
                    ? onSuccessHref.includes("/dashboard/accountant")
                      ? `/dashboard/accountant/clients/${createdFor}/entities/${savedEntity.id}/properties/new`
                      : `/dashboard/client/entities/${savedEntity.id}/properties/new`
                    : onSuccessHref
                }
                className="entity-wizard-primary"
              >
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
