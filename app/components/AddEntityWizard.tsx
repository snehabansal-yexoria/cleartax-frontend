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
    description: "Property owned in your personal name",
  },
  {
    value: "partnership",
    label: "Partnership",
    description: "Joint ownership between two or more parties",
  },
  {
    value: "company",
    label: "Company (Pty Ltd)",
    description: "Property owned through a company entity",
  },
  {
    value: "trust",
    label: "Trust (Discretionary / Unit Trust)",
    description: "Property held within a trust structure",
  },
  {
    value: "smsf",
    label: "Self Managed Super Fund (SMSF)",
    description: "Property owned through an SMSF for retirement investment",
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
  role?: "client" | "accountant";
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
  role = "client",
}: AddEntityWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
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
  const [nextStep, setNextStep] = useState<"client" | "property">("client");

  useEffect(() => {
    if (saved) {
      setTimeout(() => {
        const successLink = document.querySelector(
          ".entity-success-layer a, .entity-success-layer button"
        ) as HTMLElement | null;
        successLink?.focus();
      }, 0);
    }
  }, [saved]);

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
    const finalPatch = { ...patch };
    if (patch.percentage !== undefined) {
      finalPatch.percentage = formatPercentageInput(patch.percentage);
    }
    setBeneficiaries((current) =>
      current.map((row) => (row.uid === uid ? { ...row, ...finalPatch } : row)),
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
    setNextStep("client");
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

  async function handleSave(goTo: "client" | "property" = "client") {
    setNextStep(goTo);
    const entity = await submit();
    if (entity) setSaved(true);
  }

  function handleNameContinue() {
    if (needsBeneficiaries) {
      setStep(3);
      return;
    }

    handleSave("client");
  }

  async function handleAddAnother() {
    const entity = await submit();
    if (entity) {
      resetState();
      if (addAnotherHref) router.push(addAnotherHref);
    }
  }

  if (role === "accountant") {
    return (
      <section className="entity-wizard">
        <div className="entity-wizard-top">
          <Link href={backHref} className="entity-wizard-back">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
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
          <div
            className="entity-wizard-card"
            onKeyDown={saved ? undefined : (e) => {
              if (e.key === "Enter") {
                const canContinue = entityType && (entityType !== "trust" || trustType);
                if (canContinue) {
                  e.preventDefault();
                  setStep(2);
                }
              }
            }}
          >
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
                disabled={!entityType || (entityType === "trust" && !trustType) || saved}
                onClick={() => setStep(2)}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div
            className="entity-wizard-card"
            onKeyDown={saved ? undefined : (e) => {
              if (e.key === "Enter" && entityName.trim() && !isSaving) {
                e.preventDefault();
                handleNameContinue();
              }
            }}
          >
            <header>
              <h2>
                {entityType === "individual"
                  ? "Individual"
                  : entityType === "partnership"
                    ? "Partnership"
                    : entityType === "company"
                      ? "Company (Pty Ltd)"
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
                            ? "Enter the full name as per the trust deed"
                            : trustType === "hybrid"
                              ? "Enter the full name as per the trust deed"
                              : "Enter the full name as per the trust deed"
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
              <div className="entity-wizard-error flex items-center gap-1.5 mt-2 animate-fadeIn">
                <svg className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <span className="text-[0.78rem] font-medium tracking-tight">{errorMessage}</span>
              </div>
            )}

            <div className="entity-wizard-footer">
              <button
                type="button"
                className="entity-wizard-link"
                onClick={() => setStep(1)}
                disabled={saved}
              >
                Back
              </button>
              {needsBeneficiaries ? (
                <button
                  type="button"
                  className="entity-wizard-primary"
                  disabled={!entityName.trim() || isSaving || saved}
                  onClick={handleNameContinue}
                >
                  Continue
                </button>
              ) : isEditMode ? (
                <button
                  type="button"
                  className="entity-wizard-primary"
                  disabled={!entityName.trim() || isSaving || saved}
                  onClick={() => handleSave("client")}
                >
                  {isSaving ? "Saving..." : "Update Entity"}
                </button>
              ) : (
                <div className="entity-wizard-footer-actions">
                  <button
                    type="button"
                    className="entity-wizard-secondary"
                    disabled={!entityName.trim() || isSaving || saved}
                    onClick={() => handleSave("client")}
                  >
                    {isSaving && nextStep === "client" ? "Saving..." : "Save Entity"}
                  </button>
                  <button
                    type="button"
                    className="entity-wizard-primary"
                    disabled={!entityName.trim() || isSaving || saved}
                    onClick={() => handleSave("property")}
                  >
                    {isSaving && nextStep === "property" ? "Saving..." : "Save and start adding property"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div
            className="entity-wizard-card"
            onKeyDown={saved ? undefined : (e) => {
              if (e.key === "Enter" && beneficiariesValid && !isSaving) {
                e.preventDefault();
                handleSave();
              }
            }}
          >
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
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block" }}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Another {beneficiaryNoun}
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
              <div className="entity-wizard-error flex items-center gap-1.5 mt-2 animate-fadeIn">
                <svg className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <span className="text-[0.78rem] font-medium tracking-tight">Total ownership cannot exceed 100%.</span>
              </div>
            )}

            {errorMessage && (
              <div className="entity-wizard-error flex items-center gap-1.5 mt-2 animate-fadeIn">
                <svg className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <span className="text-[0.78rem] font-medium tracking-tight">{errorMessage}</span>
              </div>
            )}

            <div className="entity-wizard-footer">
              <button
                type="button"
                className="entity-wizard-link"
                onClick={() => setStep(2)}
                disabled={saved}
              >
                Back
              </button>
              {isEditMode ? (
                <button
                  type="button"
                  className="entity-wizard-primary"
                  disabled={!beneficiariesValid || isSaving || saved}
                  onClick={() => handleSave("client")}
                >
                  {isSaving ? "Saving..." : "Update Entity"}
                </button>
              ) : (
                <div className="entity-wizard-footer-actions">
                  <button
                    type="button"
                    className="entity-wizard-secondary"
                    disabled={!beneficiariesValid || isSaving || saved}
                    onClick={() => handleSave("client")}
                  >
                    {isSaving && nextStep === "client" ? "Saving..." : "Save Entity"}
                  </button>
                  <button
                    type="button"
                    className="entity-wizard-primary"
                    disabled={!beneficiariesValid || isSaving || saved}
                    onClick={() => handleSave("property")}
                  >
                    {isSaving && nextStep === "property" ? "Saving..." : "Save and start adding property"}
                  </button>
                </div>
              )}
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
                    !isEditMode && nextStep === "property" && savedEntity
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
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
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
                  onKeyDown={saved ? undefined : (e) => {
                    if (e.key === "Enter") {
                      if (needsBeneficiaries) {
                        e.preventDefault();
                        const firstBeneficiaryInput = document.querySelector(".entity-beneficiary-name") as HTMLInputElement | null;
                        if (firstBeneficiaryInput) {
                          firstBeneficiaryInput.focus();
                        }
                      } else if (entityName.trim() && entityType && !isSaving) {
                        e.preventDefault();
                        handleSave();
                      }
                    }
                  }}
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
                        onKeyDown={saved ? undefined : (e) => {
                          if (e.key === "Enter" && entityName.trim() && entityType && beneficiariesValid && !isSaving) {
                            e.preventDefault();
                            handleSave();
                          }
                        }}
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
                          onKeyDown={saved ? undefined : (e) => {
                            if (e.key === "Enter" && entityName.trim() && entityType && beneficiariesValid && !isSaving) {
                              e.preventDefault();
                              handleSave();
                            }
                          }}
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
                  <div className="entity-wizard-error flex items-center gap-1.5 mt-2 animate-fadeIn">
                    <svg className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <span className="text-[0.78rem] font-medium tracking-tight">Total ownership cannot exceed 100%.</span>
                  </div>
                )}
              </div>
            )}

            {errorMessage && (
              <div className="entity-wizard-error flex items-center gap-1.5 mt-2 animate-fadeIn">
                <svg className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <span className="text-[0.78rem] font-medium tracking-tight">{errorMessage}</span>
              </div>
            )}

            {/* Form Actions (Cancel / Save) */}
            <div className="entity-wizard-actions">
              <Link href={backHref} className={`entity-wizard-btn-cancel${saved ? " pointer-events-none opacity-50" : ""}`}>
                Cancel
              </Link>
              <div className="entity-wizard-btn-group">
                {isEditMode ? (
                  <button
                    type="button"
                    className="entity-wizard-btn-save"
                    disabled={!entityName.trim() || !entityType || !beneficiariesValid || isSaving || saved}
                    onClick={() => handleSave("client")}
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                ) : (
                  <>
                    {!isEditMode && addAnotherHref && (
                      <button
                        type="button"
                        className="entity-wizard-btn-secondary"
                        disabled={!entityName.trim() || !entityType || !beneficiariesValid || isSaving || saved}
                        onClick={handleAddAnother}
                      >
                        Add Another Entity
                      </button>
                    )}
                    <button
                      type="button"
                      className="entity-wizard-btn-secondary"
                      disabled={!entityName.trim() || !entityType || !beneficiariesValid || isSaving || saved}
                      onClick={() => handleSave("client")}
                    >
                      {isSaving && nextStep === "client" ? "Saving..." : "Save Entity"}
                    </button>
                    <button
                      type="button"
                      className="entity-wizard-btn-save"
                      disabled={!entityName.trim() || !entityType || !beneficiariesValid || isSaving || saved}
                      onClick={() => handleSave("property")}
                    >
                      {isSaving && nextStep === "property" ? "Saving..." : "Save and start adding property"}
                    </button>
                  </>
                )}
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
                  !isEditMode && nextStep === "property" && savedEntity
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
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        : String(Number(beneficiary.ownershipPercentage.toFixed(2))),
  }));
}

function formatPercentage(value: number) {
  if (Math.abs(value - Math.round(value)) < 0.001) {
    return `${Math.round(value)}%`;
  }
  return `${Number(value.toFixed(2))}%`;
}

function formatPercentageInput(val: string): string {
  if (!val) return "";

  // Remove everything except digits and one decimal point
  let cleaned = val.replace(/[^0-9.]/g, "");

  // Handle multiple decimals (only keep the first one)
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    cleaned = parts[0] + "." + parts.slice(1).join("");
  }

  // Limit decimal places to 2
  const [integer, decimal] = cleaned.split(".");
  if (decimal !== undefined) {
    return integer + "." + decimal.slice(0, 2);
  }
  return integer;
}
