"use client";

import { useEffect, useState, useId, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSession } from "@/src/lib/session";
import type { CoreEntity, CoreProperty, PropertyType } from "@/src/lib/coreApi";

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

const demoEntities: CoreEntity[] = [
  {
    id: "demo-entity-1",
    orgId: "demo-org",
    entityType: "trust",
    name: "Johnson Family Trust",
    createdFor: "demo-client",
    createdBy: "demo-user",
    updatedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reconciled: false,
    reconciledAt: null,
    propertiesCount: 2,
    transactionsCount: 0,
    beneficiaries: [
      { id: 1, name: "Sarah Johnson", ownershipPercentage: 60 },
      { id: 2, name: "Michael Johnson", ownershipPercentage: 40 }
    ]
  },
  {
    id: "demo-entity-2",
    orgId: "demo-org",
    entityType: "company",
    name: "SJ Holdings Pty Ltd",
    createdFor: "demo-client",
    createdBy: "demo-user",
    updatedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reconciled: false,
    reconciledAt: null,
    propertiesCount: 1,
    transactionsCount: 0,
    beneficiaries: [
      { id: 3, name: "Sarah Johnson", ownershipPercentage: 100 }
    ]
  },
  {
    id: "demo-entity-3",
    orgId: "demo-org",
    entityType: "individual",
    name: "Sarah Johnson",
    createdFor: "demo-client",
    createdBy: "demo-user",
    updatedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reconciled: false,
    reconciledAt: null,
    propertiesCount: 0,
    transactionsCount: 0,
    beneficiaries: [
      { id: 4, name: "Sarah Johnson", ownershipPercentage: 100 }
    ]
  }
];

type BeneficiaryRow = {
  entityBeneficiaryId: number | null;
  name: string;
  percentage: string;
};

type UploadedDocumentRef = {
  documentId: string;
  s3Key: string;
  filename: string;
};

function titleCase(value: string) {
  if (!value) return "";
  return value
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatAUD(val: string): string {
  let cleaned = val.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    cleaned = parts[0] + "." + parts.slice(1).join("");
  }
  if (!cleaned) return "";
  let [integer, decimal] = cleaned.split(".");
  integer = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  let formatted = "$" + integer;
  if (decimal !== undefined) {
    formatted += "." + decimal.slice(0, 2);
  }
  return formatted;
}

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function uploadViaPresign({
  token,
  file,
  onProgress,
  documentType,
  entityId,
}: {
  token: string;
  file: File;
  onProgress?: (progress: number) => void;
  documentType?: string;
  entityId?: string;
}) {
  onProgress?.(5);
  const qs = new URLSearchParams({ filename: file.name });
  if (documentType) qs.set("document_type", documentType);
  if (entityId) qs.set("entity_id", entityId);
  const presignRes = await fetch(`/api/documents/presign?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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

export default function NewPropertyPage() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [entities, setEntities] = useState<CoreEntity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form states
  const [propertyName, setPropertyName] = useState("");
  const [propertyType, setPropertyType] = useState<PropertyType | "">("");
  const [locationText, setLocationText] = useState("");
  const [status, setStatus] = useState("");
  
  // Status details dates
  const [availableForRentDate, setAvailableForRentDate] = useState("");
  const [firstRentalIncomeDate, setFirstRentalIncomeDate] = useState("");
  const [renovationStartDate, setRenovationStartDate] = useState("");
  const [renovationEndDate, setRenovationEndDate] = useState("");

  // Property Image states
  const [imageUrl, setImageUrl] = useState("");
  const [propertyImageName, setPropertyImageName] = useState("");
  const [propertyImageProgress, setPropertyImageProgress] = useState(0);
  const [isUploadingPropertyImage, setIsUploadingPropertyImage] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);

  // Financial details
  const [estimatedMarketValue, setEstimatedMarketValue] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [hasDepreciationSchedule, setHasDepreciationSchedule] = useState(false);

  // Depreciation Schedule Document states
  const [depreciationScheduleDocument, setDepreciationScheduleDocument] = useState<UploadedDocumentRef | null>(null);
  const [depreciationUploadProgress, setDepreciationUploadProgress] = useState(0);
  const [isUploadingDepreciationSchedule, setIsUploadingDepreciationSchedule] = useState(false);
  const [isDraggingDoc, setIsDraggingDoc] = useState(false);

  // Beneficiaries
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryRow[]>([]);

  // Loan details
  const [bankName, setBankName] = useState("");
  const [bsbNumber, setBsbNumber] = useState("");
  const [loanAccountNumber, setLoanAccountNumber] = useState("");
  const [loanAllocationPercentage, setLoanAllocationPercentage] = useState("");
  const [loanAmount, setLoanAmount] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [isEntityOpen, setIsEntityOpen] = useState(false);
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);

  const entityDropdownId = `entity-dropdown-${useId()}`;
  const typeDropdownId = `type-dropdown-${useId()}`;
  const statusDropdownId = `status-dropdown-${useId()}`;

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) {
          router.replace("/login/user");
          return;
        }
        const token = session.getIdToken().getJwtToken();
        const res = await fetch("/api/entities", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const items = data.items || [];
          if (items.length > 0) {
            setEntities(items);
            setSelectedEntityId(items[0].id);
          } else {
            setEntities(demoEntities);
            setSelectedEntityId(demoEntities[0].id);
          }
        } else {
          setEntities(demoEntities);
          setSelectedEntityId(demoEntities[0].id);
        }
      } catch (err) {
        console.error("Failed to load entities", err);
        setEntities(demoEntities);
        setSelectedEntityId(demoEntities[0].id);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [router]);

  // Update beneficiaries when selected entity changes
  useEffect(() => {
    const activeEntity = entities.find((e) => e.id === selectedEntityId);
    if (activeEntity) {
      const initialRows = activeEntity.beneficiaries.map((b) => ({
        entityBeneficiaryId: b.id ?? null,
        name: b.name,
        percentage: String(b.ownershipPercentage ?? ""),
      }));
      setBeneficiaries(initialRows);
    } else {
      setBeneficiaries([]);
    }
  }, [selectedEntityId, entities]);

  const selectedEntity = entities.find((e) => e.id === selectedEntityId);

  // Field validations
  const isEstimatedMarketValueValid = !estimatedMarketValue || (estimatedMarketValue !== "$" && /^\$\d{1,3}(,\d{3})*(\.\d{1,2})?$/.test(estimatedMarketValue));
  const isPurchaseAmountValid = !purchaseAmount || (purchaseAmount !== "$" && /^\$\d{1,3}(,\d{3})*(\.\d{1,2})?$/.test(purchaseAmount));
  const isBankNameValid = !bankName || /^[a-zA-Z\s]*$/.test(bankName);
  const isBsbValid = !bsbNumber || bsbNumber.length === 6;
  const isLoanAccountNumberValid = !loanAccountNumber || /^\d*$/.test(loanAccountNumber);
  const isLoanAllocationValid = !loanAllocationPercentage || (Number(loanAllocationPercentage) >= 0 && Number(loanAllocationPercentage) <= 100);
  const isLoanAmountValid = !loanAmount || (loanAmount !== "$" && /^\$\d{1,3}(,\d{3})*(\.\d{1,2})?$/.test(loanAmount));

  const totalOwnership = beneficiaries.reduce((sum, b) => {
    const val = Number.parseFloat(b.percentage);
    return sum + (Number.isFinite(val) ? val : 0);
  }, 0);

  const isLoanDetailsValid =
    isBankNameValid &&
    isBsbValid &&
    isLoanAccountNumberValid &&
    isLoanAllocationValid &&
    isLoanAmountValid;

  const isStep1Valid =
    Boolean(selectedEntityId) &&
    Boolean(propertyName.trim()) &&
    Boolean(locationText.trim()) &&
    Boolean(propertyType) &&
    Boolean(status) &&
    (status === "Available for Rent"
      ? Boolean(availableForRentDate)
      : status === "Rented"
        ? Boolean(availableForRentDate && firstRentalIncomeDate)
        : status === "Under Renovation"
          ? Boolean(renovationStartDate)
          : true);

  const isStep2Valid =
    Boolean(estimatedMarketValue) &&
    isEstimatedMarketValueValid &&
    Boolean(purchaseAmount) &&
    isPurchaseAmountValid &&
    Boolean(purchaseDate) &&
    (!hasDepreciationSchedule || Boolean(depreciationScheduleDocument)) &&
    beneficiaries.length > 0 &&
    totalOwnership > 0 &&
    totalOwnership <= 100;

  async function handleImageUpload(file: File) {
    if (isUploadingPropertyImage) return;
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please upload a valid image file.");
      return;
    }
    setErrorMessage("");
    setIsUploadingPropertyImage(true);
    setPropertyImageName(file.name);
    try {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) return;
      const token = session.getIdToken().getJwtToken();
      const uploaded = await uploadViaPresign({
        token,
        file,
        onProgress: setPropertyImageProgress,
        documentType: "property_image",
        entityId: selectedEntityId,
      });
      setImageUrl(uploaded.s3Key);
    } catch (err) {
      setErrorMessage("Failed to upload image. Please try again.");
      setPropertyImageProgress(0);
    } finally {
      setIsUploadingPropertyImage(false);
    }
  }

  async function handleDocUpload(file: File) {
    if (isUploadingDepreciationSchedule) return;
    setErrorMessage("");
    setIsUploadingDepreciationSchedule(true);
    try {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) return;
      const token = session.getIdToken().getJwtToken();
      const uploaded = await uploadViaPresign({
        token,
        file,
        onProgress: setDepreciationUploadProgress,
        documentType: "depreciation_schedule",
        entityId: selectedEntityId,
      });
      setDepreciationScheduleDocument(uploaded);
    } catch (err) {
      setErrorMessage("Failed to upload document. Please try again.");
      setDepreciationUploadProgress(0);
    } finally {
      setIsUploadingDepreciationSchedule(false);
    }
  }

  function handleSaveBeneficiary(idx: number, field: "name" | "percentage", value: string) {
    setBeneficiaries((current) =>
      current.map((row, i) => {
        if (i !== idx) return row;
        return {
          ...row,
          [field]: value,
        };
      })
    );
  }

  function addBeneficiaryRow() {
    setBeneficiaries((current) => [
      ...current,
      { entityBeneficiaryId: null, name: "", percentage: "" },
    ]);
  }

  function deleteBeneficiaryRow(idx: number) {
    setBeneficiaries((current) => current.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setErrorMessage("");
    if (!isStep1Valid || !isStep2Valid || !isLoanDetailsValid) {
      setErrorMessage("Please complete all required fields and correct errors.");
      return;
    }
    setIsSaving(true);
    try {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) return;
      const token = session.getIdToken().getJwtToken();

      const propertyStatusDetails: Record<string, any> = { status };
      if (status === "Available for Rent") {
        propertyStatusDetails.available_for_rent_date = availableForRentDate;
      } else if (status === "Rented") {
        propertyStatusDetails.available_for_rent_date = availableForRentDate;
        propertyStatusDetails.first_rental_income_date = firstRentalIncomeDate;
      } else if (status === "Under Renovation") {
        propertyStatusDetails.renovation_start_date = renovationStartDate;
        if (renovationEndDate) {
          propertyStatusDetails.renovation_end_date = renovationEndDate;
        }
      }

      const loanDetails: Record<string, any> = {
        property_status_details: propertyStatusDetails,
      };

      if (bankName.trim()) loanDetails.bank_name = bankName.trim();
      if (bsbNumber.trim()) loanDetails.bsb_number = bsbNumber.trim();
      if (loanAccountNumber.trim()) loanDetails.loan_account_number = loanAccountNumber.trim();
      if (loanAllocationPercentage.trim()) {
        loanDetails.loan_allocation_percentage = Number.parseFloat(loanAllocationPercentage);
      }
      if (loanAmount.trim()) {
        loanDetails.loan_amount = Number.parseFloat(loanAmount.replace(/[^0-9.]/g, ""));
      }

      if (depreciationScheduleDocument) {
        loanDetails.depreciation_schedule_document_id = depreciationScheduleDocument.documentId;
        loanDetails.depreciation_schedule_s3_key = depreciationScheduleDocument.s3Key;
        loanDetails.depreciation_schedule_filename = depreciationScheduleDocument.filename;
      }

      const body: Record<string, any> = {
        name: propertyName.trim(),
        property_type: propertyType,
        location_text: locationText.trim(),
        estimated_market_value: Number.parseFloat(estimatedMarketValue.replace(/[^0-9.]/g, "")),
        purchase_date: purchaseDate,
        purchase_amount: Number.parseFloat(purchaseAmount.replace(/[^0-9.]/g, "")),
        has_depreciation_schedule: hasDepreciationSchedule,
        status: status.trim(),
        owners: beneficiaries.map((b) => ({
          entity_beneficiary_id: b.entityBeneficiaryId,
          owner_name: b.name.trim(),
          ownership_percentage: Number.parseFloat(b.percentage),
        })),
        loan_details: loanDetails,
      };

      if (imageUrl.trim()) {
        body.image_url = imageUrl.trim();
      }

      const res = await fetch(`/api/entities/${selectedEntityId}/properties`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || data?.message || "Failed to create property.");
      }

      setSaved(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to add property.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleMobileNext() {
    if (step === 1 && isStep1Valid) {
      setStep(2);
    } else if (step === 2 && isStep2Valid) {
      setStep(3);
    } else if (step === 3 && isStep2Valid && isLoanDetailsValid) {
      handleSave();
    }
  }

  function handleMobileBack() {
    if (step === 3) {
      setStep(2);
    } else if (step === 2) {
      setStep(1);
    } else {
      router.push("/dashboard/client/property");
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh", background: "#f7f9fc" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "50%", border: "3px solid #1a235a", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
          <span style={{ fontSize: "15px", color: "#667085", fontWeight: 500 }}>Loading workspace...</span>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // --- MOBILE RENDER FUNCTION (figma matching) ---
  const renderMobileView = () => {
    const isCurrentStepValid = step === 1 ? isStep1Valid : step === 2 ? isStep2Valid : (isStep2Valid && isLoanDetailsValid);
    
    return (
      <div style={{ background: "#ffffff", minHeight: "100vh", paddingBottom: "90px", display: "flex", flexDirection: "column", fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        {/* Top Header */}
        <div style={{
          position: "sticky",
          top: 0,
          background: "#ffffff",
          borderBottom: "1px solid #eaeef4",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          height: "56px"
        }}>
          <button
            type="button"
            onClick={handleMobileBack}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "transparent",
              border: "none",
              fontSize: "16px",
              fontWeight: 600,
              color: "#2f3c82",
              cursor: "pointer",
              padding: 0
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "18px", height: "18px" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back
          </button>
          
          <div style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "18px",
            fontWeight: 700,
            color: "#101828"
          }}>
            Add Property
          </div>
          <div style={{ width: "60px" }} />
        </div>

        {/* Step Info Banner */}
        <div style={{
          background: "#f4f6fc",
          padding: "14px 16px",
          textAlign: "center",
          fontSize: "14px",
          fontWeight: 600,
          color: "#2f3c82",
          borderBottom: "1px solid #eaeef4"
        }}>
          Enter the below values to complete the step
        </div>

        {/* Main Content Area */}
        <div style={{ padding: "24px 20px", flex: 1 }}>
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Property Image */}
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>
                  Property Image
                </label>
                
                {isUploadingPropertyImage ? (
                  <div style={{ border: "1px solid #eaeef4", borderRadius: "12px", padding: "16px", display: "flex", alignItems: "center", gap: "12px", background: "#f8f9fc" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 500, color: "#344054", marginBottom: "4px" }}>
                        <span>Uploading...</span>
                        <span>{propertyImageProgress}%</span>
                      </div>
                      <div style={{ height: "6px", width: "100%", background: "#eaeef4", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${propertyImageProgress}%`, background: "#2f3c82" }} />
                      </div>
                    </div>
                  </div>
                ) : imageUrl ? (
                  <div style={{ border: "1px solid #eaeef4", borderRadius: "12px", padding: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8f9fc" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <img 
                        src={imageUrl.startsWith("http") || imageUrl.startsWith("/") ? imageUrl : `/api/documents/download?key=${encodeURIComponent(imageUrl)}`} 
                        alt="Preview" 
                        style={{ width: "40px", height: "40px", borderRadius: "8px", objectFit: "cover", border: "1px solid #eaeef4" }} 
                      />
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#344054" }}>Image added</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => { setImageUrl(""); setPropertyImageName(""); }}
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: "#98a2b3" }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "16px", height: "16px" }}>
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => document.getElementById("mobile-image-input")?.click()}
                    style={{
                      border: "1px solid #eaeef4",
                      background: "#f4f6fa",
                      borderRadius: "12px",
                      padding: "24px 16px",
                      textAlign: "center",
                      cursor: "pointer"
                    }}
                  >
                    <input 
                      type="file" 
                      id="mobile-image-input" 
                      accept="image/*" 
                      onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageUpload(file); }} 
                      style={{ display: "none" }} 
                    />
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#718096", marginBottom: "4px" }}>
                      Tap to add property photo
                    </div>
                    <div style={{ fontSize: "11px", color: "#a0aec0" }}>
                      JPEG, PNG max 10 MB<br />Camera or Gallery
                    </div>
                  </div>
                )}
              </div>

              {/* Entity name */}
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>
                  Entity Name <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <div style={{ position: "relative", zIndex: isEntityOpen ? 30 : 1 }}>
                  <button
                    type="button"
                    onClick={() => setIsEntityOpen(!isEntityOpen)}
                    style={{
                      width: "100%",
                      height: "48px",
                      padding: "0 16px",
                      background: "#f4f6fa",
                      border: "1px solid #eaeef4",
                      borderRadius: "12px",
                      fontSize: "14px",
                      color: selectedEntityId ? "#101828" : "#94a3b8",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      fontWeight: 500
                    }}
                  >
                    <span>{selectedEntity ? selectedEntity.name : "Select Entity"}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#667085" strokeWidth="2" style={{ width: "16px", height: "16px", transform: isEntityOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {isEntityOpen && (
                    <div style={{ position: "absolute", top: "52px", left: 0, right: 0, background: "#ffffff", border: "1px solid #eaeef4", borderRadius: "12px", boxShadow: "0px 8px 30px rgba(16, 24, 40, 0.08)", zIndex: 120, maxHeight: "180px", overflowY: "auto" }}>
                      {entities.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => { setSelectedEntityId(e.id); setIsEntityOpen(false); }}
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            textAlign: "left",
                            background: selectedEntityId === e.id ? "#f4f6fc" : "transparent",
                            border: "none",
                            fontSize: "14px",
                            color: "#101828",
                            cursor: "pointer",
                            fontWeight: selectedEntityId === e.id ? 600 : 500,
                            display: "block"
                          }}
                        >
                          {e.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Property name */}
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>
                  Property Name <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter Name"
                  value={propertyName}
                  onChange={(e) => setPropertyName(e.target.value)}
                  style={{
                    width: "100%",
                    height: "48px",
                    padding: "0 16px",
                    background: "#f4f6fa",
                    border: "1px solid #eaeef4",
                    borderRadius: "12px",
                    fontSize: "14px",
                    color: "#101828",
                    outline: "none"
                  }}
                />
              </div>

              {/* Property Location */}
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>
                  Property Location <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter location"
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  style={{
                    width: "100%",
                    height: "48px",
                    padding: "0 16px",
                    background: "#f4f6fa",
                    border: "1px solid #eaeef4",
                    borderRadius: "12px",
                    fontSize: "14px",
                    color: "#101828",
                    outline: "none"
                  }}
                />
              </div>

              {/* Property Type */}
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>
                  Property Type <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <div style={{ position: "relative", zIndex: isTypeOpen ? 30 : 1 }}>
                  <button
                    type="button"
                    onClick={() => setIsTypeOpen(!isTypeOpen)}
                    style={{
                      width: "100%",
                      height: "48px",
                      padding: "0 16px",
                      background: "#f4f6fa",
                      border: "1px solid #eaeef4",
                      borderRadius: "12px",
                      fontSize: "14px",
                      color: propertyType ? "#101828" : "#94a3b8",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      fontWeight: 500
                    }}
                  >
                    <span>{propertyType ? propertyTypeOptions.find((o) => o.value === propertyType)?.label : "Select Type"}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#667085" strokeWidth="2" style={{ width: "16px", height: "16px", transform: isTypeOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {isTypeOpen && (
                    <div style={{ position: "absolute", top: "52px", left: 0, right: 0, background: "#ffffff", border: "1px solid #eaeef4", borderRadius: "12px", boxShadow: "0px 8px 30px rgba(16, 24, 40, 0.08)", zIndex: 120 }}>
                      {propertyTypeOptions.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => { setPropertyType(o.value); setIsTypeOpen(false); }}
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            textAlign: "left",
                            background: propertyType === o.value ? "#f4f6fc" : "transparent",
                            border: "none",
                            fontSize: "14px",
                            color: "#101828",
                            cursor: "pointer",
                            fontWeight: propertyType === o.value ? 600 : 500,
                            display: "block"
                          }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Property Status */}
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>
                  Property Status <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <div style={{ position: "relative", zIndex: isStatusOpen ? 30 : 1 }}>
                  <button
                    type="button"
                    onClick={() => setIsStatusOpen(!isStatusOpen)}
                    style={{
                      width: "100%",
                      height: "48px",
                      padding: "0 16px",
                      background: "#f4f6fa",
                      border: "1px solid #eaeef4",
                      borderRadius: "12px",
                      fontSize: "14px",
                      color: status ? "#101828" : "#94a3b8",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      fontWeight: 500
                    }}
                  >
                    <span>{status || "Select Status"}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#667085" strokeWidth="2" style={{ width: "16px", height: "16px", transform: isStatusOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {isStatusOpen && (
                    <div style={{ position: "absolute", top: "52px", left: 0, right: 0, background: "#ffffff", border: "1px solid #eaeef4", borderRadius: "12px", boxShadow: "0px 8px 30px rgba(16, 24, 40, 0.08)", zIndex: 120, maxHeight: "180px", overflowY: "auto" }}>
                      {propertyStatusOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => { setStatus(opt); setIsStatusOpen(false); }}
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            textAlign: "left",
                            background: status === opt ? "#f4f6fc" : "transparent",
                            border: "none",
                            fontSize: "14px",
                            color: "#101828",
                            cursor: "pointer",
                            fontWeight: status === opt ? 600 : 500,
                            display: "block"
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Status dates */}
              {(status === "Available for Rent" || status === "Rented") && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "14px", background: "#f8f9fc", borderRadius: "12px", border: "1px solid #eaeef4" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                      Available for Rent Date <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <input
                      type="date"
                      min={getTodayString()}
                      value={availableForRentDate}
                      onChange={(e) => setAvailableForRentDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 12px",
                        background: "#ffffff",
                        border: "1px solid #eaeef4",
                        borderRadius: "8px",
                        fontSize: "13px",
                        color: "#101828"
                      }}
                    />
                  </div>
                  {status === "Rented" && (
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                        First Rental Income Date <span style={{ color: "#EF4444" }}>*</span>
                      </label>
                      <input
                        type="date"
                        min={getTodayString()}
                        value={firstRentalIncomeDate}
                        onChange={(e) => setFirstRentalIncomeDate(e.target.value)}
                        style={{
                          width: "100%",
                          height: "44px",
                          padding: "0 12px",
                          background: "#ffffff",
                          border: "1px solid #eaeef4",
                          borderRadius: "8px",
                          fontSize: "13px",
                          color: "#101828"
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {status === "Under Renovation" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "14px", background: "#f8f9fc", borderRadius: "12px", border: "1px solid #eaeef4" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                      Renovation Start Date <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <input
                      type="date"
                      min={getTodayString()}
                      value={renovationStartDate}
                      onChange={(e) => setRenovationStartDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 12px",
                        background: "#ffffff",
                        border: "1px solid #eaeef4",
                        borderRadius: "8px",
                        fontSize: "13px",
                        color: "#101828"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                      Renovation End Date <small style={{ color: "#667085" }}>(Optional)</small>
                    </label>
                    <input
                      type="date"
                      min={getTodayString()}
                      value={renovationEndDate}
                      onChange={(e) => setRenovationEndDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 12px",
                        background: "#ffffff",
                        border: "1px solid #eaeef4",
                        borderRadius: "8px",
                        fontSize: "13px",
                        color: "#101828"
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ fontSize: "11px", fontWeight: 800, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                FINANCIAL INFO
              </div>

              {/* Market and Purchase Value */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>
                    Market Value <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="$ 0"
                    value={estimatedMarketValue}
                    onChange={(e) => setEstimatedMarketValue(formatAUD(e.target.value))}
                    style={{
                      width: "100%",
                      height: "48px",
                      padding: "0 16px",
                      background: "#f4f6fa",
                      border: "1px solid #eaeef4",
                      borderRadius: "12px",
                      fontSize: "14px",
                      color: "#101828",
                      outline: "none"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>
                    Purchase Value <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="$ 0"
                    value={purchaseAmount}
                    onChange={(e) => setPurchaseAmount(formatAUD(e.target.value))}
                    style={{
                      width: "100%",
                      height: "48px",
                      padding: "0 16px",
                      background: "#f4f6fa",
                      border: "1px solid #eaeef4",
                      borderRadius: "12px",
                      fontSize: "14px",
                      color: "#101828",
                      outline: "none"
                    }}
                  />
                </div>
              </div>

              {/* Purchase Date */}
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>
                  Purchase Date <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="date"
                  max={getTodayString()}
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  style={{
                    width: "100%",
                    height: "48px",
                    padding: "0 16px",
                    background: "#f4f6fa",
                    border: "1px solid #eaeef4",
                    borderRadius: "12px",
                    fontSize: "14px",
                    color: "#101828",
                    outline: "none"
                  }}
                />
              </div>

              {/* Depreciation Schedule Radios */}
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>
                  Depreciation Schedule
                </label>
                <div style={{ display: "flex", gap: "24px", marginTop: "4px" }}>
                  <div
                    onClick={() => setHasDepreciationSchedule(true)}
                    style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#1e293b", cursor: "pointer", fontWeight: 500 }}
                  >
                    <div style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      border: hasDepreciationSchedule ? "2.5px solid #1B265C" : "2px solid #A0AEC0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxSizing: "border-box",
                      transition: "all 0.2s"
                    }}>
                      {hasDepreciationSchedule && (
                        <div style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          background: "#1B265C"
                        }} />
                      )}
                    </div>
                    Yes
                  </div>
                  <div
                    onClick={() => {
                      setHasDepreciationSchedule(false);
                      setDepreciationScheduleDocument(null);
                      setDepreciationUploadProgress(0);
                    }}
                    style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#1e293b", cursor: "pointer", fontWeight: 500 }}
                  >
                    <div style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      border: !hasDepreciationSchedule ? "2.5px solid #1B265C" : "2px solid #A0AEC0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxSizing: "border-box",
                      transition: "all 0.2s"
                    }}>
                      {!hasDepreciationSchedule && (
                        <div style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          background: "#1B265C"
                        }} />
                      )}
                    </div>
                    No
                  </div>
                </div>

                {hasDepreciationSchedule && (
                  <div style={{ marginTop: "12px" }}>
                    {isUploadingDepreciationSchedule ? (
                      <div style={{ border: "1px solid #eaeef4", borderRadius: "12px", padding: "12px", background: "#f8f9fc" }}>
                        <div style={{ fontSize: "12px", fontWeight: 500, color: "#344054" }}>Uploading depreciation document ({depreciationUploadProgress}%)</div>
                      </div>
                    ) : depreciationScheduleDocument ? (
                      <div style={{ border: "1px solid #eaeef4", borderRadius: "12px", padding: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8f9fc" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#344054" }}>{depreciationScheduleDocument.filename}</span>
                        <button type="button" onClick={() => setDepreciationScheduleDocument(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#98a2b3" }}>✕</button>
                      </div>
                    ) : (
                      <div
                        onClick={() => document.getElementById("mobile-doc-input")?.click()}
                        style={{ border: "1px dashed #eaeef4", background: "#f8f9fc", borderRadius: "12px", padding: "16px", textAlign: "center", cursor: "pointer" }}
                      >
                        <input 
                          type="file" 
                          id="mobile-doc-input" 
                          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" 
                          onChange={(e) => { const file = e.target.files?.[0]; if (file) handleDocUpload(file); }} 
                          style={{ display: "none" }} 
                        />
                        <span style={{ fontSize: "13px", color: "#2f3c82", fontWeight: 600 }}>+ Upload depreciation schedule</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Beneficiaries section */}
              <div style={{ borderTop: "1px solid #eaeef4", paddingTop: "20px", marginTop: "10px" }}>
                <div style={{ fontSize: "11px", fontWeight: 800, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "12px" }}>
                  BENEFICIARIES
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
                  {beneficiaries.map((b, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="Beneficiary name"
                        value={b.name}
                        onChange={(e) => handleSaveBeneficiary(idx, "name", e.target.value)}
                        style={{
                          flex: 1,
                          height: "48px",
                          padding: "0 16px",
                          background: "#f4f6fa",
                          border: "1px solid #eaeef4",
                          borderRadius: "12px",
                          fontSize: "14px",
                          color: "#101828",
                          outline: "none"
                        }}
                      />
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <input
                          type="number"
                          placeholder="0"
                          value={b.percentage}
                          onChange={(e) => handleSaveBeneficiary(idx, "percentage", e.target.value)}
                          style={{
                            width: "60px",
                            height: "48px",
                            padding: "0 12px",
                            background: "#f4f6fa",
                            border: "1px solid #eaeef4",
                            borderRadius: "12px",
                            fontSize: "14px",
                            color: "#101828",
                            outline: "none",
                            textAlign: "center"
                          }}
                        />
                        <span style={{ fontSize: "14px", color: "#667085", fontWeight: 700 }}>%</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteBeneficiaryRow(idx)}
                        style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ width: "18px", height: "18px" }}>
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Beneficiary Button */}
                <button
                  type="button"
                  onClick={addBeneficiaryRow}
                  style={{
                    width: "100%",
                    height: "48px",
                    background: "#ffffff",
                    border: "1px solid #1B265C",
                    borderRadius: "12px",
                    color: "#1B265C",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    marginBottom: "16px"
                  }}
                >
                  <span style={{ fontSize: "16px" }}>+</span> Add Beneficiary
                </button>

                {/* Total ownership warning row */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 16px",
                  background: "#fffdf0",
                  border: "1px solid #fef08a",
                  borderRadius: "12px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#b45309"
                }}>
                  <span>Total Ownership:</span>
                  <span>{totalOwnership.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ fontSize: "11px", fontWeight: 800, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                LOAN DETAILS - OPTIONAL
              </div>

              {/* Bank Name */}
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>
                  Bank Name
                </label>
                <input
                  type="text"
                  placeholder="eg., Wells Fargo"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  style={{
                    width: "100%",
                    height: "48px",
                    padding: "0 16px",
                    background: "#f4f6fa",
                    border: "1px solid #eaeef4",
                    borderRadius: "12px",
                    fontSize: "14px",
                    color: "#101828",
                    outline: "none"
                  }}
                />
              </div>

              {/* BSB Number and Loan % Allocation */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>
                    BSB Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 123-456"
                    value={bsbNumber}
                    onChange={(e) => setBsbNumber(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    style={{
                      width: "100%",
                      height: "48px",
                      padding: "0 16px",
                      background: "#f4f6fa",
                      border: "1px solid #eaeef4",
                      borderRadius: "12px",
                      fontSize: "14px",
                      color: "#101828",
                      outline: "none"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>
                    Loan % Allocation
                  </label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type="number"
                      placeholder="0 %"
                      min="0"
                      max="100"
                      value={loanAllocationPercentage}
                      onChange={(e) => setLoanAllocationPercentage(e.target.value)}
                      style={{
                        width: "100%",
                        height: "48px",
                        padding: "0 24px 0 12px",
                        background: "#f4f6fa",
                        border: "1px solid #eaeef4",
                        borderRadius: "12px",
                        fontSize: "14px",
                        color: "#101828",
                        outline: "none"
                      }}
                    />
                    <span style={{ position: "absolute", right: "12px", fontSize: "14px", color: "#667085", fontWeight: 500 }}>%</span>
                  </div>
                </div>
              </div>

              {/* Loan Account Number */}
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>
                  Loan Account Number
                </label>
                <input
                  type="text"
                  placeholder="Enter account number"
                  value={loanAccountNumber}
                  onChange={(e) => setLoanAccountNumber(e.target.value.replace(/\D/g, ""))}
                  style={{
                    width: "100%",
                    height: "48px",
                    padding: "0 16px",
                    background: "#f4f6fa",
                    border: "1px solid #eaeef4",
                    borderRadius: "12px",
                    fontSize: "14px",
                    color: "#101828",
                    outline: "none"
                  }}
                />
              </div>

              {/* Loan Amount */}
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>
                  Loan Amount
                </label>
                <input
                  type="text"
                  placeholder="Enter amount"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(formatAUD(e.target.value))}
                  style={{
                    width: "100%",
                    height: "48px",
                    padding: "0 16px",
                    background: "#f4f6fa",
                    border: "1px solid #eaeef4",
                    borderRadius: "12px",
                    fontSize: "14px",
                    color: "#101828",
                    outline: "none"
                  }}
                />
              </div>
            </div>
          )}

          {/* Mobile Error Message */}
          {errorMessage && (
            <div style={{ marginTop: "16px", padding: "12px 16px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "8px", color: "#991b1b", fontSize: "13px", fontWeight: 500 }}>
              {errorMessage}
            </div>
          )}
        </div>

        {/* Mobile Bottom Footer */}
        <div style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#ffffff",
          borderTop: "1px solid #eaeef4",
          boxShadow: "0px -4px 10px rgba(0, 0, 0, 0.04)",
          padding: "16px 20px",
          zIndex: 200
        }}>
          <button
            type="button"
            disabled={!isCurrentStepValid || isSaving}
            onClick={handleMobileNext}
            style={{
              width: "100%",
              height: "48px",
              borderRadius: "12px",
              background: isCurrentStepValid ? "#1B265C" : "#A2AABF",
              border: "none",
              color: "#ffffff",
              fontSize: "16px",
              fontWeight: 700,
              cursor: isCurrentStepValid ? "pointer" : "not-allowed",
              transition: "all 0.2s"
            }}
          >
            {step === 3 ? (isSaving ? "Saving..." : "Save and Add Property") : "Continue"}
          </button>
        </div>

        {/* Success Modal */}
        {saved && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(16, 24, 40, 0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: "#ffffff", borderRadius: "24px", padding: "36px 24px", width: "90%", maxWidth: "340px", textAlign: "center", boxShadow: "0px 20px 48px rgba(16, 24, 40, 0.12)", border: "1px solid #eaeef4" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px auto" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" style={{ width: "32px", height: "32px" }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#101828", margin: "0 0 8px 0" }}>Property Added</h3>
              <p style={{ fontSize: "13px", color: "#667085", margin: "0 0 24px 0", lineHeight: "1.4" }}>
                <strong>{propertyName}</strong> has been added successfully.
              </p>
              <Link
                href="/dashboard/client/property"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "44px",
                  width: "100%",
                  background: "#1B265C",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#ffffff",
                  textDecoration: "none"
                }}
              >
                View Properties
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- DESKTOP RENDER FUNCTION (already built & verified) ---
  const renderDesktopView = () => {
    return (
      <div style={{ background: "#f7f9fc", minHeight: "100vh", padding: "40px", fontFamily: '"Inter", sans-serif' }}>
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#667085", fontWeight: 500, marginBottom: "8px" }}>
            <Link href="/dashboard/client/property" style={{ color: "#2f3c82", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "14px", height: "14px" }}>
                <path d="M15 19l-7-7 7-7" />
              </svg>
              Properties
            </Link>
            <span>/</span>
            <span style={{ color: "#344054" }}>Add property</span>
          </div>
          <h1 style={{ fontSize: "32px", fontWeight: 800, color: "#101828", margin: "0 0 4px 0", letterSpacing: "-0.02em" }}>
            Add a new property
          </h1>
          <p style={{ fontSize: "15px", color: "#667085", margin: 0, fontWeight: 400 }}>
            Enter the property details, financial info, and link any supporting documents
          </p>
        </div>

        <div style={{ width: "100%" }}>
          {step === 1 && (
            <div style={{ background: "#ffffff", borderRadius: "16px", border: "1px solid #eaeef4", padding: "32px", boxShadow: "0px 8px 30px rgba(16, 24, 40, 0.02)" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#667085", letterSpacing: "0.08em", marginBottom: "20px", textTransform: "uppercase" }}>
                STEP 1 — PROPERTY DETAILS
              </div>

              {/* Property Image Dropzone */}
              <div style={{ marginBottom: "28px" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#344054", marginBottom: "8px" }}>
                  Property image
                </label>
                
                {isUploadingPropertyImage ? (
                  <div style={{ border: "1px solid #eaeef4", borderRadius: "12px", padding: "20px", display: "flex", alignItems: "center", gap: "16px", background: "#f8f9fc" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "#eaeef4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#2f3c82" strokeWidth="2" style={{ width: "20px", height: "20px" }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: 500, color: "#344054", marginBottom: "4px" }}>
                        <span>Uploading property image...</span>
                        <span>{propertyImageProgress}%</span>
                      </div>
                      <div style={{ height: "6px", width: "100%", background: "#eaeef4", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${propertyImageProgress}%`, background: "#2f3c82", transition: "width 0.1s ease" }} />
                      </div>
                    </div>
                  </div>
                ) : imageUrl ? (
                  <div style={{ border: "1px solid #eaeef4", borderRadius: "12px", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8f9fc" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <img 
                        src={imageUrl.startsWith("http") || imageUrl.startsWith("/") ? imageUrl : `/api/documents/download?key=${encodeURIComponent(imageUrl)}`} 
                        alt="Preview" 
                        style={{ width: "48px", height: "48px", borderRadius: "8px", objectFit: "cover", border: "1px solid #eaeef4" }} 
                      />
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "#344054" }}>{propertyImageName || "Property Image"}</div>
                        <div style={{ fontSize: "12px", color: "#10b981", fontWeight: 500 }}>Successfully uploaded</div>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => { setImageUrl(""); setPropertyImageName(""); }}
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: "#98a2b3", padding: "8px" }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "18px", height: "18px" }}>
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingImage(true); }}
                    onDragLeave={() => setIsDraggingImage(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDraggingImage(false); const file = e.dataTransfer.files?.[0]; if (file) handleImageUpload(file); }}
                    style={{
                      border: `2px dashed ${isDraggingImage ? "#2f3c82" : "#eaeef4"}`,
                      background: isDraggingImage ? "#f4f6fc" : "#f8f9fc",
                      borderRadius: "12px",
                      padding: "36px 20px",
                      textAlign: "center",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                    onClick={() => document.getElementById("image-upload-input")?.click()}
                  >
                    <input 
                      type="file" 
                      id="image-upload-input" 
                      accept="image/*" 
                      onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageUpload(file); }} 
                      style={{ display: "none" }} 
                    />
                    <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "#ffffff", border: "1px solid #eaeef4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px auto", boxShadow: "0px 2px 8px rgba(16, 24, 40, 0.02)" }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#667085" strokeWidth="2" style={{ width: "20px", height: "20px" }}>
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#101828", marginBottom: "4px" }}>
                      Tap to add property photo
                    </div>
                    <div style={{ fontSize: "12px", color: "#667085", fontWeight: 400 }}>
                      JPEG, PNG max 10 MB<br />Camera or Gallery
                    </div>
                  </div>
                )}
              </div>

              {/* Entity Name & Property Name Fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#344054", marginBottom: "8px" }}>
                    Entity name <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => setIsEntityOpen(!isEntityOpen)}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 16px",
                        background: "#ffffff",
                        border: "1px solid #eaeef4",
                        borderRadius: "8px",
                        fontSize: "14px",
                        color: selectedEntityId ? "#101828" : "#98a2b3",
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        fontWeight: 500
                      }}
                    >
                      <span>{selectedEntity ? selectedEntity.name : "Select Entity"}</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#667085" strokeWidth="2" style={{ width: "16px", height: "16px", transform: isEntityOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {isEntityOpen && (
                      <div style={{ position: "absolute", top: "48px", left: 0, right: 0, background: "#ffffff", border: "1px solid #eaeef4", borderRadius: "8px", boxShadow: "0px 8px 30px rgba(16, 24, 40, 0.08)", zIndex: 30, maxHeight: "200px", overflowY: "auto" }}>
                        {entities.map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => { setSelectedEntityId(e.id); setIsEntityOpen(false); }}
                            style={{
                              width: "100%",
                              padding: "12px 16px",
                              textAlign: "left",
                              background: selectedEntityId === e.id ? "#f4f6fc" : "transparent",
                              border: "none",
                              fontSize: "14px",
                              color: "#101828",
                              cursor: "pointer",
                              fontWeight: selectedEntityId === e.id ? 600 : 500,
                              display: "block"
                            }}
                          >
                            {e.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#344054", marginBottom: "8px" }}>
                    Property name <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter name"
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    style={{
                      width: "100%",
                      height: "44px",
                      padding: "0 16px",
                      background: "#ffffff",
                      border: "1px solid #eaeef4",
                      borderRadius: "8px",
                      fontSize: "14px",
                      color: "#101828",
                      outline: "none"
                    }}
                  />
                </div>
              </div>

              {/* Property Location Field */}
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#344054", marginBottom: "8px" }}>
                  Property location <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter location"
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  style={{
                    width: "100%",
                    height: "44px",
                    padding: "0 16px",
                    background: "#ffffff",
                    border: "1px solid #eaeef4",
                    borderRadius: "8px",
                    fontSize: "14px",
                    color: "#101828",
                    outline: "none"
                  }}
                />
              </div>

              {/* Property Type & Status Dropdowns */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#344054", marginBottom: "8px" }}>
                    Property type <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => setIsTypeOpen(!isTypeOpen)}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 16px",
                        background: "#ffffff",
                        border: "1px solid #eaeef4",
                        borderRadius: "8px",
                        fontSize: "14px",
                        color: propertyType ? "#101828" : "#98a2b3",
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        fontWeight: 500
                      }}
                    >
                      <span>{propertyType ? propertyTypeOptions.find((o) => o.value === propertyType)?.label : "Select Type"}</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#667085" strokeWidth="2" style={{ width: "16px", height: "16px", transform: isTypeOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {isTypeOpen && (
                      <div style={{ position: "absolute", top: "48px", left: 0, right: 0, background: "#ffffff", border: "1px solid #eaeef4", borderRadius: "8px", boxShadow: "0px 8px 30px rgba(16, 24, 40, 0.08)", zIndex: 30 }}>
                        {propertyTypeOptions.map((o) => (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => { setPropertyType(o.value); setIsTypeOpen(false); }}
                            style={{
                              width: "100%",
                              padding: "12px 16px",
                              textAlign: "left",
                              background: propertyType === o.value ? "#f4f6fc" : "transparent",
                              border: "none",
                              fontSize: "14px",
                              color: "#101828",
                              cursor: "pointer",
                              fontWeight: propertyType === o.value ? 600 : 500,
                              display: "block"
                            }}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#344054", marginBottom: "8px" }}>
                    Property status <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => setIsStatusOpen(!isStatusOpen)}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 16px",
                        background: "#ffffff",
                        border: "1px solid #eaeef4",
                        borderRadius: "8px",
                        fontSize: "14px",
                        color: status ? "#101828" : "#98a2b3",
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        fontWeight: 500
                      }}
                    >
                      <span>{status || "Select Status"}</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#667085" strokeWidth="2" style={{ width: "16px", height: "16px", transform: isStatusOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {isStatusOpen && (
                      <div style={{ position: "absolute", top: "48px", left: 0, right: 0, background: "#ffffff", border: "1px solid #eaeef4", borderRadius: "8px", boxShadow: "0px 8px 30px rgba(16, 24, 40, 0.08)", zIndex: 30, maxHeight: "200px", overflowY: "auto" }}>
                        {propertyStatusOptions.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => { setStatus(opt); setIsStatusOpen(false); }}
                            style={{
                              width: "100%",
                              padding: "12px 16px",
                              textAlign: "left",
                              background: status === opt ? "#f4f6fc" : "transparent",
                              border: "none",
                              fontSize: "14px",
                              color: "#101828",
                              cursor: "pointer",
                              fontWeight: status === opt ? 600 : 500,
                              display: "block"
                            }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Date Conditionals */}
              {(status === "Available for Rent" || status === "Rented") && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px", padding: "16px", background: "#f8f9fc", borderRadius: "8px", border: "1px solid #eaeef4" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#344054", marginBottom: "6px" }}>
                      Available for Rent Date <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <input
                      type="date"
                      min={getTodayString()}
                      value={availableForRentDate}
                      onChange={(e) => setAvailableForRentDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: "40px",
                        padding: "0 12px",
                        background: "#ffffff",
                        border: "1px solid #eaeef4",
                        borderRadius: "6px",
                        fontSize: "13px",
                        color: "#101828"
                      }}
                    />
                  </div>
                  {status === "Rented" && (
                    <div>
                      <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#344054", marginBottom: "6px" }}>
                        First Rental Income Date <span style={{ color: "#EF4444" }}>*</span>
                      </label>
                      <input
                        type="date"
                        min={getTodayString()}
                        value={firstRentalIncomeDate}
                        onChange={(e) => setFirstRentalIncomeDate(e.target.value)}
                        style={{
                          width: "100%",
                          height: "40px",
                          padding: "0 12px",
                          background: "#ffffff",
                          border: "1px solid #eaeef4",
                          borderRadius: "6px",
                          fontSize: "13px",
                          color: "#101828"
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {status === "Under Renovation" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px", padding: "16px", background: "#f8f9fc", borderRadius: "8px", border: "1px solid #eaeef4" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#344054", marginBottom: "6px" }}>
                      Renovation Start Date <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <input
                      type="date"
                      min={getTodayString()}
                      value={renovationStartDate}
                      onChange={(e) => setRenovationStartDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: "40px",
                        padding: "0 12px",
                        background: "#ffffff",
                        border: "1px solid #eaeef4",
                        borderRadius: "6px",
                        fontSize: "13px",
                        color: "#101828"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#344054", marginBottom: "6px" }}>
                      Renovation End Date <small style={{ color: "#667085" }}>(Optional)</small>
                    </label>
                    <input
                      type="date"
                      min={getTodayString()}
                      value={renovationEndDate}
                      onChange={(e) => setRenovationEndDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: "40px",
                        padding: "0 12px",
                        background: "#ffffff",
                        border: "1px solid #eaeef4",
                        borderRadius: "6px",
                        fontSize: "13px",
                        color: "#101828"
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Step 1 Footer */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "32px", borderTop: "1px solid #eaeef4", paddingTop: "24px" }}>
                <Link
                  href="/dashboard/client/property"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "44px",
                    padding: "0 20px",
                    background: "#ffffff",
                    border: "1px solid #d0d5dd",
                    borderRadius: "8px",
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "#344054",
                    textDecoration: "none",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </Link>
                <button
                  type="button"
                  disabled={!isStep1Valid}
                  onClick={() => setStep(2)}
                  style={{
                    height: "44px",
                    padding: "0 24px",
                    background: isStep1Valid ? "#1a235a" : "#cbd5e1",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "#ffffff",
                    cursor: isStep1Valid ? "pointer" : "not-allowed"
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step >= 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Step 2 Form Card */}
              <div style={{ background: "#ffffff", borderRadius: "16px", border: "1px solid #eaeef4", padding: "32px", boxShadow: "0px 8px 30px rgba(16, 24, 40, 0.02)" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#667085", letterSpacing: "0.08em", marginBottom: "20px", textTransform: "uppercase" }}>
                  STEP 2 — FINANCIAL INFO
                </div>

                {/* Financial values row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", marginBottom: "24px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#344054", marginBottom: "8px" }}>
                      Market value <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="$0"
                      value={estimatedMarketValue}
                      onChange={(e) => setEstimatedMarketValue(formatAUD(e.target.value))}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 16px",
                        background: "#ffffff",
                        border: "1px solid #eaeef4",
                        borderRadius: "8px",
                        fontSize: "14px",
                        color: "#101828",
                        outline: "none"
                      }}
                    />
                    {!isEstimatedMarketValueValid && (
                      <span style={{ fontSize: "12px", color: "#EF4444", marginTop: "4px", display: "block" }}>
                        Must accept only AUD format ($).
                      </span>
                    )}
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#344054", marginBottom: "8px" }}>
                      Purchase value <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="$0"
                      value={purchaseAmount}
                      onChange={(e) => setPurchaseAmount(formatAUD(e.target.value))}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 16px",
                        background: "#ffffff",
                        border: "1px solid #eaeef4",
                        borderRadius: "8px",
                        fontSize: "14px",
                        color: "#101828",
                        outline: "none"
                      }}
                    />
                    {!isPurchaseAmountValid && (
                      <span style={{ fontSize: "12px", color: "#EF4444", marginTop: "4px", display: "block" }}>
                        Must accept only AUD format ($).
                      </span>
                    )}
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#344054", marginBottom: "8px" }}>
                      Purchase date <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <input
                      type="date"
                      max={getTodayString()}
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 16px",
                        background: "#ffffff",
                        border: "1px solid #eaeef4",
                        borderRadius: "8px",
                        fontSize: "14px",
                        color: "#101828",
                        outline: "none"
                      }}
                    />
                  </div>
                </div>

                {/* Depreciation schedule */}
                <div style={{ marginBottom: "28px" }}>
                  <span style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#344054", marginBottom: "10px" }}>
                    Depreciation schedule
                  </span>
                  <div style={{ display: "flex", gap: "24px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#344054", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="depreciation"
                        checked={hasDepreciationSchedule}
                        onChange={() => setHasDepreciationSchedule(true)}
                        style={{ width: "16px", height: "16px", accentColor: "#1a235a" }}
                      />
                      Yes
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#344054", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="depreciation"
                        checked={!hasDepreciationSchedule}
                        onChange={() => {
                          setHasDepreciationSchedule(false);
                          setDepreciationScheduleDocument(null);
                          setDepreciationUploadProgress(0);
                        }}
                        style={{ width: "16px", height: "16px", accentColor: "#1a235a" }}
                      />
                      No
                    </label>
                  </div>

                  {hasDepreciationSchedule && (
                    <div style={{ marginTop: "16px" }}>
                      {isUploadingDepreciationSchedule ? (
                        <div style={{ border: "1px solid #eaeef4", borderRadius: "12px", padding: "20px", display: "flex", alignItems: "center", gap: "16px", background: "#f8f9fc" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: 500, color: "#344054", marginBottom: "4px" }}>
                              <span>Uploading...</span>
                              <span>{depreciationUploadProgress}%</span>
                            </div>
                            <div style={{ height: "6px", width: "100%", background: "#eaeef4", borderRadius: "3px", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${depreciationUploadProgress}%`, background: "#2f3c82" }} />
                            </div>
                          </div>
                        </div>
                      ) : depreciationScheduleDocument ? (
                        <div style={{ border: "1px solid #eaeef4", borderRadius: "12px", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8f9fc" }}>
                          <span style={{ fontSize: "14px", fontWeight: 600, color: "#344054" }}>{depreciationScheduleDocument.filename}</span>
                          <button type="button" onClick={() => setDepreciationScheduleDocument(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#98a2b3" }}>✕</button>
                        </div>
                      ) : (
                        <div
                          onClick={() => document.getElementById("doc-upload-input")?.click()}
                          style={{ border: "2px dashed #eaeef4", background: "#f8f9fc", borderRadius: "12px", padding: "24px 20px", textAlign: "center", cursor: "pointer" }}
                        >
                          <input type="file" id="doc-upload-input" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleDocUpload(file); }} style={{ display: "none" }} />
                          <span style={{ fontSize: "13px", color: "#2f3c82", fontWeight: 600 }}>Click to upload depreciation schedule</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Beneficiaries */}
                <div style={{ borderTop: "1px solid #eaeef4", paddingTop: "24px", marginTop: "24px" }}>
                  <span style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", letterSpacing: "0.08em", marginBottom: "16px" }}>
                    BENEFICIARIES
                  </span>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 48px", gap: "16px", marginBottom: "8px", padding: "0 8px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>BENEFICIARY NAME</span>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>OWNERSHIP %</span>
                    <span />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
                    {beneficiaries.map((b, idx) => (
                      <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 140px 48px", gap: "16px", alignItems: "center" }}>
                        <input
                          type="text"
                          placeholder="Beneficiary name"
                          value={b.name}
                          onChange={(e) => handleSaveBeneficiary(idx, "name", e.target.value)}
                          style={{ width: "100%", height: "44px", padding: "0 16px", border: "1px solid #eaeef4", borderRadius: "8px", fontSize: "14px", color: "#101828", outline: "none" }}
                        />
                        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                          <input
                            type="number"
                            placeholder="0"
                            value={b.percentage}
                            onChange={(e) => handleSaveBeneficiary(idx, "percentage", e.target.value)}
                            style={{ width: "100%", height: "44px", padding: "0 32px 0 16px", border: "1px solid #eaeef4", borderRadius: "8px", fontSize: "14px", color: "#101828", outline: "none", textAlign: "right" }}
                          />
                          <span style={{ position: "absolute", right: "16px", fontSize: "14px", color: "#667085" }}>%</span>
                        </div>
                        <button type="button" onClick={() => deleteBeneficiaryRow(idx)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444" }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "20px", height: "20px" }}>
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>

                  <button type="button" onClick={addBeneficiaryRow} style={{ background: "transparent", border: "none", fontSize: "14px", fontWeight: 600, color: "#2f3c82", cursor: "pointer", padding: "8px 0", marginBottom: "20px" }}>
                    + Add beneficiary
                  </button>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: totalOwnership === 100 ? "#f0fdf4" : "#fffbeb", border: `1px solid ${totalOwnership === 100 ? "#bbf7d0" : "#fef3c7"}`, borderRadius: "8px", fontSize: "14px", fontWeight: 600, color: totalOwnership === 100 ? "#15803d" : "#b45309" }}>
                    <span>Total ownership</span>
                    <span>{totalOwnership.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Step 3 Card (Loan details) */}
              <div style={{ background: "#ffffff", borderRadius: "16px", border: "1px solid #eaeef4", padding: "32px", boxShadow: "0px 8px 30px rgba(16, 24, 40, 0.02)" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#667085", letterSpacing: "0.08em", marginBottom: "20px", textTransform: "uppercase" }}>
                  STEP 3 — LOAN DETAILS (OPTIONAL)
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#344054", marginBottom: "8px" }}>Bank name</label>
                  <input type="text" placeholder="e.g. Wells Fargo" value={bankName} onChange={(e) => setBankName(e.target.value)} style={{ width: "100%", height: "44px", padding: "0 16px", border: "1px solid #eaeef4", borderRadius: "8px", fontSize: "14px", color: "#101828", outline: "none" }} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#344054", marginBottom: "8px" }}>BSB number</label>
                    <input type="text" placeholder="e.g. 123-456" value={bsbNumber} onChange={(e) => setBsbNumber(e.target.value.replace(/\D/g, "").slice(0, 6))} style={{ width: "100%", height: "44px", padding: "0 16px", border: "1px solid #eaeef4", borderRadius: "8px", fontSize: "14px", color: "#101828", outline: "none" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#344054", marginBottom: "8px" }}>Loan % allocation</label>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <input type="number" placeholder="0 %" value={loanAllocationPercentage} onChange={(e) => setLoanAllocationPercentage(e.target.value)} style={{ width: "100%", height: "44px", padding: "0 32px 0 16px", border: "1px solid #eaeef4", borderRadius: "8px", fontSize: "14px", color: "#101828" }} />
                      <span style={{ position: "absolute", right: "16px", fontSize: "14px", color: "#667085" }}>%</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#344054", marginBottom: "8px" }}>Loan account number</label>
                    <input type="text" placeholder="Enter account number" value={loanAccountNumber} onChange={(e) => setLoanAccountNumber(e.target.value.replace(/\D/g, ""))} style={{ width: "100%", height: "44px", padding: "0 16px", border: "1px solid #eaeef4", borderRadius: "8px", fontSize: "14px", color: "#101828", outline: "none" }} />
                  </div>
                </div>

                <div style={{ marginBottom: "10px" }}>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#344054", marginBottom: "8px" }}>Loan amount</label>
                  <input type="text" placeholder="Enter amount" value={loanAmount} onChange={(e) => setLoanAmount(formatAUD(e.target.value))} style={{ width: "100%", height: "44px", padding: "0 16px", border: "1px solid #eaeef4", borderRadius: "8px", fontSize: "14px", color: "#101828", outline: "none" }} />
                </div>
              </div>

              {errorMessage && (
                <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "8px", color: "#991b1b", fontSize: "14px" }}>
                  {errorMessage}
                </div>
              )}

              {/* Step 2 Footer */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px", background: "#ffffff", borderRadius: "12px", border: "1px solid #eaeef4", padding: "16px 24px" }}>
                <button type="button" onClick={() => setStep(1)} style={{ height: "44px", padding: "0 20px", background: "#ffffff", border: "1px solid #d0d5dd", borderRadius: "8px", fontSize: "15px", fontWeight: 600, color: "#344054" }}>Back</button>
                <button type="button" disabled={isSaving || !isStep2Valid || !isLoanDetailsValid} onClick={handleSave} style={{ height: "44px", padding: "0 24px", background: (isStep2Valid && isLoanDetailsValid) ? "#1a235a" : "#cbd5e1", border: "none", borderRadius: "8px", fontSize: "15px", fontWeight: 600, color: "#ffffff", cursor: (isStep2Valid && isLoanDetailsValid) ? "pointer" : "not-allowed" }}>
                  {isSaving ? "Saving..." : "Save and add property"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Success Overlay */}
        {saved && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(16, 24, 40, 0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: "#ffffff", borderRadius: "24px", padding: "36px 24px", width: "90%", maxWidth: "440px", textAlign: "center", boxShadow: "0px 20px 48px rgba(16, 24, 40, 0.12)", border: "1px solid #eaeef4" }}>
              <div style={{ width: "80px", height: "80px", margin: "0 auto 24px auto", borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" style={{ width: "40px", height: "40px" }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#101828", margin: "0 0 12px 0" }}>Property Added Successfully</h3>
              <p style={{ fontSize: "14px", color: "#667085", margin: "0 0 28px 0" }}>
                <strong>{propertyName}</strong> is now linked to <strong>{selectedEntity?.name}</strong>.
              </p>
              <Link href="/dashboard/client/property" style={{ display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", height: "44px", width: "100%", background: "#1a235a", borderRadius: "8px", fontSize: "15px", fontWeight: 600, color: "#ffffff", textDecoration: "none" }}>View Properties List</Link>
            </div>
          </div>
        )}
      </div>
    );
  };

  return isMobile ? renderMobileView() : renderDesktopView();
}
