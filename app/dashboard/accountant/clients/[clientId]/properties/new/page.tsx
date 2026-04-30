"use client";

import { Skeleton } from "boneyard-js/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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

type PropertyStep = 1 | 2 | 3;

type OwnerRow = {
  id: string;
  name: string;
  percentage: string;
};

type PropertyForm = {
  propertyName: string;
  propertyType: string;
  location: string;
  marketValue: string;
  purchaseDate: string;
  purchaseAmount: string;
  depreciationSchedule: "yes" | "no";
  propertyStatus: string;
  bankName: string;
  bsbNumber: string;
  loanAccountNumber: string;
  loanAllocation: string;
  loanAmount: string;
};

function createOwnerRow(name = "", percentage = "0"): OwnerRow {
  return {
    id: Math.random().toString(36).slice(2, 10),
    name,
    percentage,
  };
}

function parseOwnershipSeed(seed: string | null) {
  if (!seed) {
    return [createOwnerRow("", "0")];
  }

  const rows = seed
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [name, percentage] = item.split(":");
      return createOwnerRow(name || "", percentage || "0");
    });

  return rows.length > 0 ? rows : [createOwnerRow("", "0")];
}

function getTotalOwnership(rows: OwnerRow[]) {
  return rows.reduce((sum, row) => {
    const value = Number.parseFloat(row.percentage || "0");
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function formatMoney(value: string) {
  const amount = Number.parseFloat(value || "0");
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export default function AccountantAddPropertyPage() {
  const params = useParams<{ clientId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const clientId = String(params?.clientId || "");
  const [isLoading, setIsLoading] = useState(true);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [currentStep, setCurrentStep] = useState<PropertyStep>(1);
  const [owners, setOwners] = useState<OwnerRow[]>(() =>
    parseOwnershipSeed(searchParams.get("ownership")),
  );
  const [showSuccess, setShowSuccess] = useState(false);
  const [form, setForm] = useState<PropertyForm>({
    propertyName: "",
    propertyType: "",
    location: "",
    marketValue: "",
    purchaseDate: "",
    purchaseAmount: "",
    depreciationSchedule: "no",
    propertyStatus: "Listed For Sale",
    bankName: "",
    bsbNumber: "",
    loanAccountNumber: "",
    loanAllocation: "0",
    loanAmount: "",
  });

  const entityName = searchParams.get("entityName") || "New Entity";
  const entityType = searchParams.get("entityType") || "Individual";

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
        console.error("Failed to load client for property flow:", error);
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
      router.push(`/dashboard/accountant/clients/${clientId}`);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [showSuccess, clientId, router]);

  const totalOwnership = useMemo(() => getTotalOwnership(owners), [owners]);
  const ownershipTone = totalOwnership === 100 ? "is-complete" : "is-warning";

  function updateForm(field: keyof PropertyForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleBack() {
    if (currentStep === 1) {
      router.push(`/dashboard/accountant/clients/${clientId}/entities/new`);
      return;
    }

    setCurrentStep((previous) => (previous === 3 ? 2 : 1));
  }

  function handleContinue() {
    if (currentStep === 1) {
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      setCurrentStep(3);
      return;
    }

    setShowSuccess(true);
  }

  return (
    <Skeleton
      name="accountant-add-property"
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

        <div className="accountant-entity-stepper accountant-property-stepper">
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
              <strong>Property Details</strong>
              <p>Basic Information</p>
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
              <strong>Ownership Details</strong>
              <p>Define Ownership</p>
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
              <strong>Loan Details</strong>
              <p>Optional Financing Info</p>
            </div>
          </article>
        </div>

        <div className="accountant-entity-flow-card">
          {currentStep === 1 && (
            <>
              <div className="accountant-entity-flow-header">
                <h1>Property Details</h1>
                <p>Enter the basic information about the property</p>
              </div>

              <div className="accountant-entity-selected-type">
                <span>Entity: {entityName}</span>
                <strong>Type: {entityType}</strong>
              </div>

              <div className="accountant-property-form-grid">
                <div className="accountant-property-field accountant-property-field-full">
                  <label>
                    Property Name <span>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Sunset District Residence"
                    value={form.propertyName}
                    onChange={(event) => updateForm("propertyName", event.target.value)}
                  />
                </div>

                <div className="accountant-property-field">
                  <label>
                    Property Type <span>*</span>
                  </label>
                  <select
                    value={form.propertyType}
                    onChange={(event) => updateForm("propertyType", event.target.value)}
                  >
                    <option value="">Select Type</option>
                    <option value="Residential">Residential</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Industrial">Industrial</option>
                  </select>
                </div>

                <div className="accountant-property-field">
                  <label>
                    Property Location <span>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Search location..."
                    value={form.location}
                    onChange={(event) => updateForm("location", event.target.value)}
                  />
                </div>

                <div className="accountant-property-field">
                  <label>
                    Estimated Market Value <span>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="$ 0"
                    value={form.marketValue}
                    onChange={(event) => updateForm("marketValue", event.target.value)}
                  />
                </div>

                <div className="accountant-property-field">
                  <label>
                    Purchase Date <span>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    value={form.purchaseDate}
                    onChange={(event) => updateForm("purchaseDate", event.target.value)}
                  />
                </div>

                <div className="accountant-property-field">
                  <label>
                    Property Purchase Amount <span>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="$ 0"
                    value={form.purchaseAmount}
                    onChange={(event) =>
                      updateForm("purchaseAmount", event.target.value)
                    }
                  />
                </div>

                <div className="accountant-property-field">
                  <label>Depreciation Schedule</label>
                  <div className="accountant-radio-group">
                    <label>
                      <input
                        type="radio"
                        name="depreciation"
                        checked={form.depreciationSchedule === "yes"}
                        onChange={() => updateForm("depreciationSchedule", "yes")}
                      />
                      Yes
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="depreciation"
                        checked={form.depreciationSchedule === "no"}
                        onChange={() => updateForm("depreciationSchedule", "no")}
                      />
                      No
                    </label>
                  </div>
                </div>

                <div className="accountant-property-field accountant-property-field-full">
                  <label>
                    Property Status <span>*</span>
                  </label>
                  <select
                    value={form.propertyStatus}
                    onChange={(event) => updateForm("propertyStatus", event.target.value)}
                  >
                    <option>Listed For Sale</option>
                    <option>Rented</option>
                    <option>Vacant</option>
                    <option>Self Occupied</option>
                  </select>
                </div>
              </div>

              <div className="accountant-entity-flow-footer">
                <button type="button" className="is-ghost" onClick={handleBack}>
                  Back
                </button>
                <button
                  type="button"
                  className="is-primary"
                  onClick={handleContinue}
                  disabled={!form.propertyName.trim()}
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {currentStep === 2 && (
            <>
              <div className="accountant-entity-flow-header">
                <h1>Ownership Details</h1>
                <p>Define who owns this property and their ownership percentages</p>
              </div>

              <div className="accountant-entity-selected-type">
                <span>Entity: {entityName}</span>
                <strong>Type: {entityType}</strong>
              </div>

              <div className="accountant-beneficiary-list">
                {owners.map((owner) => (
                  <div key={owner.id} className="accountant-beneficiary-row">
                    <input
                      type="text"
                      value={owner.name}
                      onChange={(event) =>
                        setOwners((current) =>
                          current.map((row) =>
                            row.id === owner.id
                              ? { ...row, name: event.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                    <div className="accountant-beneficiary-percentage">
                      <input
                        type="text"
                        value={owner.percentage}
                        onChange={(event) =>
                          setOwners((current) =>
                            current.map((row) =>
                              row.id === owner.id
                                ? {
                                    ...row,
                                    percentage: event.target.value.replace(/[^\d.]/g, ""),
                                  }
                                : row,
                            ),
                          )
                        }
                      />
                      <span>%</span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="accountant-property-add-owner"
                onClick={() =>
                  setOwners((current) => [...current, createOwnerRow("", "0")])
                }
              >
                + Add Owner
              </button>

              <div className={`accountant-ownership-summary ${ownershipTone}`}>
                <span>Total Ownership</span>
                <strong>{totalOwnership}%</strong>
              </div>

              <div className="accountant-entity-flow-footer">
                <button type="button" className="is-ghost" onClick={handleBack}>
                  Back
                </button>
                <button type="button" className="is-primary" onClick={handleContinue}>
                  Continue
                </button>
              </div>
            </>
          )}

          {currentStep === 3 && (
            <>
              <div className="accountant-entity-flow-header">
                <h1>Loan Details</h1>
                <p>Add loan information for this property (all fields optional)</p>
              </div>

              <div className="accountant-property-form-grid">
                <div className="accountant-property-field accountant-property-field-full">
                  <label>Bank Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Wells Fargo"
                    value={form.bankName}
                    onChange={(event) => updateForm("bankName", event.target.value)}
                  />
                </div>

                <div className="accountant-property-field">
                  <label>BSB Number</label>
                  <input
                    type="text"
                    placeholder="e.g., 123-456"
                    value={form.bsbNumber}
                    onChange={(event) => updateForm("bsbNumber", event.target.value)}
                  />
                </div>

                <div className="accountant-property-field">
                  <label>Loan Account Number</label>
                  <input
                    type="text"
                    placeholder="Enter account number"
                    value={form.loanAccountNumber}
                    onChange={(event) =>
                      updateForm("loanAccountNumber", event.target.value)
                    }
                  />
                </div>

                <div className="accountant-property-field">
                  <label>Loan % Allocation</label>
                  <input
                    type="text"
                    placeholder="0%"
                    value={form.loanAllocation}
                    onChange={(event) => updateForm("loanAllocation", event.target.value)}
                  />
                </div>

                <div className="accountant-property-field">
                  <label>Loan Amount</label>
                  <input
                    type="text"
                    placeholder="Enter amount"
                    value={form.loanAmount}
                    onChange={(event) => updateForm("loanAmount", event.target.value)}
                  />
                </div>
              </div>

              <div className="accountant-property-summary-card">
                <h2>Property Summary</h2>
                <div className="accountant-property-summary-grid">
                  <div>
                    <span>Property Name</span>
                    <strong>{form.propertyName || "Sneha"}</strong>
                  </div>
                  <div>
                    <span>Type</span>
                    <strong>{form.propertyType || "Residential"}</strong>
                  </div>
                  <div>
                    <span>Estimated Value</span>
                    <strong>{formatMoney(form.marketValue || "22222")}</strong>
                  </div>
                  <div>
                    <span>Total Owners</span>
                    <strong>{owners.length}</strong>
                  </div>
                </div>
              </div>

              <div className="accountant-entity-flow-footer">
                <button type="button" className="is-ghost" onClick={handleBack}>
                  Back
                </button>
                <button
                  type="button"
                  className="accountant-property-submit"
                  onClick={() => setShowSuccess(true)}
                >
                  Add Property
                </button>
              </div>
            </>
          )}
        </div>

        {showSuccess && (
          <div className="accountant-entity-success-layer">
            <div className="accountant-entity-success-card">
              <h2>New Property Secured !</h2>
              <p>
                Successfully added to the client ledger. All future
                transactions can now be assigned here for easier reporting.
                Returning to the client dashboard.
              </p>
            </div>
          </div>
        )}
      </section>
    </Skeleton>
  );
}
