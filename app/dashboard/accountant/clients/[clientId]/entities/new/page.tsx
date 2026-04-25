"use client";

import { Skeleton } from "boneyard-js/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AccountantClientsSkeleton } from "../../../../../../components/PortalSkeletons";
import { getSession } from "../../../../../../../src/lib/session";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

interface ClientDetail {
  id: string;
  email: string;
  status: string;
  name: string;
}

type EntityTypeOption =
  | "Individual"
  | "Partnership"
  | "Company (Pvt Ltd)"
  | "Trust (Discretionary/ Unit)"
  | "Self Managed Super Fund (SMSF)";

type EntityStep = 1 | 2 | 3;

type BeneficiaryRow = {
  id: string;
  name: string;
  percentage: string;
};

const ENTITY_TYPES: Array<{
  label: EntityTypeOption;
  description: string;
}> = [
  {
    label: "Individual",
    description: "Single person ownership with direct asset control",
  },
  {
    label: "Partnership",
    description: "Shared ownership between two or more partners",
  },
  {
    label: "Company (Pvt Ltd)",
    description: "Limited liability company structure with shareholders",
  },
  {
    label: "Trust (Discretionary/ Unit)",
    description: "Asset protection and flexible distribution to beneficiaries",
  },
  {
    label: "Self Managed Super Fund (SMSF)",
    description: "Tax-effective retirement savings and investment vehicle",
  },
];

function createBeneficiaryRow(): BeneficiaryRow {
  return {
    id: Math.random().toString(36).slice(2, 10),
    name: "",
    percentage: "0",
  };
}

function getTotalOwnership(rows: BeneficiaryRow[]) {
  return rows.reduce((sum, row) => {
    const value = Number.parseFloat(row.percentage || "0");
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function formatOwnership(total: number) {
  return `${total.toFixed(1)}%`;
}

function buildOwnershipSeed(params: {
  entityName: string;
  beneficiaries: BeneficiaryRow[];
}) {
  const namedBeneficiaries = params.beneficiaries.filter((beneficiary) =>
    beneficiary.name.trim(),
  );

  if (namedBeneficiaries.length > 0) {
    return namedBeneficiaries
      .map(
        (beneficiary) =>
          `${beneficiary.name.trim()}:${beneficiary.percentage || "0"}`,
      )
      .join("|");
  }

  return `${params.entityName.trim() || "Owner"}:100`;
}

export default function AccountantAddEntityPage() {
  const params = useParams<{ clientId: string }>();
  const router = useRouter();
  const clientId = String(params?.clientId || "");
  const [isLoading, setIsLoading] = useState(true);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [currentStep, setCurrentStep] = useState<EntityStep>(1);
  const [selectedType, setSelectedType] = useState<EntityTypeOption | "">("");
  const [entityName, setEntityName] = useState("");
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryRow[]>([
    createBeneficiaryRow(),
  ]);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    async function loadClient() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;

        if (!session || !clientId) {
          return;
        }

        const token = session.getIdToken().getJwtToken();
        const res = await fetch(`/api/users/me/clients/${clientId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          return;
        }

        const data = await res.json();
        setClient(data.client || null);
      } catch (error) {
        console.error("Failed to load client for entity flow:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadClient();
  }, [clientId]);

  useEffect(() => {
    if (!showSuccess) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({
        entityName: entityName.trim() || "New Entity",
        entityType: selectedType || "Individual",
        ownership: buildOwnershipSeed({
          entityName,
          beneficiaries,
        }),
      });
      router.push(
        `/dashboard/accountant/clients/${clientId}/properties/new?${query.toString()}`,
      );
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [showSuccess, clientId, entityName, selectedType, beneficiaries, router]);

  const requiresBeneficiaries = useMemo(
    () =>
      selectedType === "Partnership" ||
      selectedType === "Trust (Discretionary/ Unit)",
    [selectedType],
  );

  const totalOwnership = useMemo(
    () => getTotalOwnership(beneficiaries),
    [beneficiaries],
  );

  const ownershipTone =
    totalOwnership === 100 ? "is-complete" : "is-warning";

  function resetFlow() {
    setCurrentStep(1);
    setSelectedType("");
    setEntityName("");
    setBeneficiaries([createBeneficiaryRow()]);
  }

  function handleContinue() {
    if (currentStep === 1 && selectedType) {
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2 && entityName.trim()) {
      if (requiresBeneficiaries) {
        setCurrentStep(3);
      } else {
        setShowSuccess(true);
      }
    }
  }

  function handleBack() {
    if (currentStep === 1) {
      router.push(`/dashboard/accountant/clients/${clientId}`);
      return;
    }

    setCurrentStep((previous) => (previous === 3 ? 2 : 1));
  }

  function updateBeneficiary(
    rowId: string,
    field: keyof Omit<BeneficiaryRow, "id">,
    value: string,
  ) {
    setBeneficiaries((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [field]: field === "percentage" ? value.replace(/[^\d.]/g, "") : value,
            }
          : row,
      ),
    );
  }

  function removeBeneficiary(rowId: string) {
    setBeneficiaries((current) =>
      current.length === 1
        ? current.map((row) =>
            row.id === rowId ? { ...row, name: "", percentage: "0" } : row,
          )
        : current.filter((row) => row.id !== rowId),
    );
  }

  return (
    <Skeleton
      name="accountant-add-entity"
      loading={isLoading}
      fallback={<AccountantClientsSkeleton />}
    >
      <section className="accountant-entity-flow-page">
        <Link
          href={`/dashboard/accountant/clients/${clientId}`}
          className="accountant-back-link"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
            <path d="M9 12h10" />
          </svg>
          {client?.name ? `Back to ${client.name}` : "Back"}
        </Link>

        <div className="accountant-entity-stepper">
          <article
            className={`accountant-entity-step${
              currentStep === 1 ? " is-active" : currentStep > 1 ? " is-complete" : ""
            }`}
          >
            <span
              className={`accountant-entity-step-circle${
                currentStep > 1 ? " is-complete" : currentStep === 1 ? " is-active" : ""
              }`}
            >
              {currentStep > 1 ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m5 13 4 4L19 7" />
                </svg>
              ) : (
                "1"
              )}
            </span>
            <div>
              <strong>Choose Entity Type</strong>
              <p>Select the type of entity</p>
            </div>
          </article>

          <span
            className={`accountant-entity-step-line${
              currentStep > 1 ? " is-active" : ""
            }`}
          />

          <article
            className={`accountant-entity-step${
              currentStep >= 2 ? " is-active" : ""
            }`}
          >
            <span
              className={`accountant-entity-step-circle${
                currentStep > 2 ? " is-complete" : currentStep === 2 ? " is-active" : ""
              }`}
            >
              {currentStep > 2 ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m5 13 4 4L19 7" />
                </svg>
              ) : (
                "2"
              )}
            </span>
            <div>
              <strong>Enter Entity Name</strong>
              <p>Name client entity</p>
            </div>
          </article>

          <span
            className={`accountant-entity-step-line${
              currentStep > 2 ? " is-active" : ""
            }`}
          />

          <article
            className={`accountant-entity-step${
              currentStep === 3 ? " is-active" : ""
            }`}
          >
            <span
              className={`accountant-entity-step-circle${
                currentStep === 3 ? " is-active" : ""
              }`}
            >
              3
            </span>
            <div>
              <strong>Add Beneficiaries</strong>
              <p>Define ownership structure</p>
            </div>
          </article>
        </div>

        <div className="accountant-entity-flow-card">
          {currentStep === 1 && (
            <>
              <div className="accountant-entity-flow-header">
                <h1>Choose Entity Type</h1>
                <p>Select the type of entity you want to create</p>
              </div>

              <div className="accountant-entity-type-grid">
                {ENTITY_TYPES.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className={`accountant-entity-type-card${
                      selectedType === option.label ? " is-selected" : ""
                    }`}
                    onClick={() => setSelectedType(option.label)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                ))}
              </div>

              <div className="accountant-entity-flow-footer">
                <button type="button" className="is-ghost" onClick={handleBack}>
                  Back
                </button>
                <button
                  type="button"
                  className="is-primary"
                  onClick={handleContinue}
                  disabled={!selectedType}
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {currentStep === 2 && (
            <>
              <div className="accountant-entity-flow-header">
                <h1>Enter Entity Name</h1>
                <p>Give client entity a clear, identifiable name</p>
              </div>

              <div className="accountant-entity-field">
                <label htmlFor="entity-name">
                  Entity Name <span>*</span>
                </label>
                <input
                  id="entity-name"
                  type="text"
                  placeholder="e.g., Smith Family Trust, ABC Properties LLC"
                  value={entityName}
                  onChange={(event) => setEntityName(event.target.value)}
                />
              </div>

              <div className="accountant-entity-selected-type">
                Selected Type: {selectedType}
              </div>

              <div className="accountant-entity-flow-footer">
                <button type="button" className="is-ghost" onClick={handleBack}>
                  Back
                </button>
                <button
                  type="button"
                  className="is-primary"
                  onClick={handleContinue}
                  disabled={!entityName.trim()}
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {currentStep === 3 && (
            <>
              <div className="accountant-entity-flow-header">
                <h1>Add Beneficiaries</h1>
                <p>
                  Define who benefits from this entity and their ownership
                  percentages
                </p>
              </div>

              <div className="accountant-beneficiary-list">
                {beneficiaries.map((beneficiary) => (
                  <div key={beneficiary.id} className="accountant-beneficiary-row">
                    <input
                      type="text"
                      placeholder="Beneficiary name"
                      value={beneficiary.name}
                      onChange={(event) =>
                        updateBeneficiary(beneficiary.id, "name", event.target.value)
                      }
                    />
                    <div className="accountant-beneficiary-percentage">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={beneficiary.percentage}
                        onChange={(event) =>
                          updateBeneficiary(
                            beneficiary.id,
                            "percentage",
                            event.target.value,
                          )
                        }
                      />
                      <span>%</span>
                      <button
                        type="button"
                        className="accountant-beneficiary-remove"
                        onClick={() => removeBeneficiary(beneficiary.id)}
                        aria-label="Remove beneficiary"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="accountant-add-beneficiary"
                onClick={() =>
                  setBeneficiaries((current) => [...current, createBeneficiaryRow()])
                }
              >
                + Add Another Beneficiary
              </button>

              <div className={`accountant-ownership-summary ${ownershipTone}`}>
                <span>Total Ownership:</span>
                <strong>{formatOwnership(totalOwnership)}</strong>
              </div>

              <div className="accountant-entity-flow-footer">
                <button type="button" className="is-ghost" onClick={handleBack}>
                  Back
                </button>
                <div className="accountant-entity-flow-actions">
                  <button
                    type="button"
                    className="is-secondary"
                    onClick={resetFlow}
                  >
                    Add Another Entity
                  </button>
                  <button
                    type="button"
                    className="is-primary"
                    onClick={() => setShowSuccess(true)}
                    disabled={
                      requiresBeneficiaries &&
                      beneficiaries.every(
                        (beneficiary) =>
                          !beneficiary.name.trim() &&
                          Number.parseFloat(beneficiary.percentage || "0") === 0,
                      )
                    }
                  >
                    Save & Start Adding Property
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {showSuccess && (
          <div className="accountant-entity-success-layer">
            <div className="accountant-entity-success-card">
              <h2>Entity Successfully Added !</h2>
              <p>
                You&apos;ve successfully registered this entity. It&apos;s now
                ready for property and transaction mapping.
              </p>
            </div>
          </div>
        )}
      </section>
    </Skeleton>
  );
}
