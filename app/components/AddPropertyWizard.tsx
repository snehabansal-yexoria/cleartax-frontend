"use client";

import { Fragment, useEffect, useId, useMemo, useState, ClipboardEvent } from "react";
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

const CURRENCY_SYMBOL = "A$ ";

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
  const clean = value ? value.replace(/[^0-9.]/g, "") : "";
  const amount = Number.parseFloat(clean);
  if (!Number.isFinite(amount)) return `${CURRENCY_SYMBOL}0`;
  const formattedNumber = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(amount);
  return `${CURRENCY_SYMBOL}${formattedNumber}`;
}

function toInputNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "";
}

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateString(text: string): string | null {
  const clean = text.trim();
  if (!clean) return null;

  // Pattern 1: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = clean.match(/^(\d{4})[-./\s](\d{1,2})[-./\s](\d{1,2})$/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, "0");
    const d = ymdMatch[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Pattern 2: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-./\s](\d{1,2})[-./\s](\d{4})$/);
  if (dmyMatch) {
    let first = parseInt(dmyMatch[1], 10);
    let second = parseInt(dmyMatch[2], 10);
    const y = dmyMatch[3];

    let d = first;
    let m = second;
    if (second > 12) {
      d = second;
      m = first;
    }

    const dStr = String(d).padStart(2, "0");
    const mStr = String(m).padStart(2, "0");
    return `${y}-${mStr}-${dStr}`;
  }

  // Native parse for formats like "May 27, 2026"
  const parsed = Date.parse(clean);
  if (!isNaN(parsed)) {
    const dObj = new Date(parsed);
    const y = dObj.getFullYear();
    const m = String(dObj.getMonth() + 1).padStart(2, "0");
    const d = String(dObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return null;
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

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isValidCurrency(val: string): boolean {
  if (!val) return true;
  if (val === CURRENCY_SYMBOL || val === CURRENCY_SYMBOL.trim()) return false;
  const escapedSymbol = escapeRegExp(CURRENCY_SYMBOL);
  const pattern = new RegExp(`^${escapedSymbol}\\d{1,3}(,\\d{3})*(\\.\\d{1,2})?$`);
  return pattern.test(val);
}

function formatAUD(val: string): string {
  // Remove everything except digits and one decimal point
  let cleaned = val.replace(/[^0-9.]/g, "");

  // Handle multiple decimals (only keep the first one)
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    cleaned = parts[0] + "." + parts.slice(1).join("");
  }

  if (!cleaned) return "";

  // Format integer part with thousands separators
  let [integer, decimal] = cleaned.split(".");
  integer = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  let formatted = CURRENCY_SYMBOL + integer;
  if (decimal !== undefined) {
    formatted += "." + decimal.slice(0, 2);
  }
  return formatted;
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
  const [estimatedMarketValue, setEstimatedMarketValue] = useState(() => {
    const raw = initialProperty?.estimatedMarketValue;
    return raw ? formatAUD(String(raw)) : "";
  });
  const [purchaseDate, setPurchaseDate] = useState(
    initialProperty?.purchaseDate ?? "",
  );
  const [settlementDate, setSettlementDate] = useState(
    initialProperty?.settlementDate ?? "",
  );
  const [purchaseAmount, setPurchaseAmount] = useState(() => {
    const raw = initialProperty?.purchaseAmount;
    return raw ? formatAUD(String(raw)) : "";
  });
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
  const [loanAmount, setLoanAmount] = useState(() => {
    const raw = getLoanDetail(initialProperty, "loan_amount");
    return raw ? formatAUD(raw) : "";
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isDraggingDoc, setIsDraggingDoc] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  const markTouched = (field: string) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };

  const dateErrors = useMemo(() => {
    const errors: {
      purchaseDate?: string;
      settlementDate?: string;
      availableForRentDate?: string;
      firstRentalIncomeDate?: string;
      renovationStartDate?: string;
      renovationEndDate?: string;
    } = {};

    const today = getTodayString();

    // 1. Contract Date (purchaseDate) validation
    if (!purchaseDate) {
      errors.purchaseDate = "Contract Date is required.";
    } else {
      const parts = purchaseDate.split("-");
      if (parts.length !== 3 || parts[0].length !== 4 || parts[1].length !== 2 || parts[2].length !== 2) {
        errors.purchaseDate = "Please enter a valid date (YYYY-MM-DD).";
      } else if (purchaseDate > today) {
        errors.purchaseDate = "Contract Date cannot be in the future.";
      }
    }

    // 2. Settlement Date validation
    if (settlementDate) {
      const parts = settlementDate.split("-");
      if (parts.length !== 3 || parts[0].length !== 4 || parts[1].length !== 2 || parts[2].length !== 2) {
        errors.settlementDate = "Please enter a valid date (YYYY-MM-DD).";
      } else if (purchaseDate && settlementDate < purchaseDate) {
        errors.settlementDate = "Settlement Date must be on or after the Contract Date.";
      }
    }

    // 3. Status-specific validations
    if (status === "Available for Rent" || status === "Rented") {
      if (!availableForRentDate) {
        errors.availableForRentDate = "Available for Rent Date is required.";
      } else {
        const parts = availableForRentDate.split("-");
        if (parts.length !== 3 || parts[0].length !== 4 || parts[1].length !== 2 || parts[2].length !== 2) {
          errors.availableForRentDate = "Please enter a valid date (YYYY-MM-DD).";
        } else if (purchaseDate && availableForRentDate < purchaseDate) {
          errors.availableForRentDate = "Available for Rent Date cannot be before the Contract Date.";
        }
      }
    }

    if (status === "Rented") {
      if (!firstRentalIncomeDate) {
        errors.firstRentalIncomeDate = "First Rental Income Date is required.";
      } else {
        const parts = firstRentalIncomeDate.split("-");
        if (parts.length !== 3 || parts[0].length !== 4 || parts[1].length !== 2 || parts[2].length !== 2) {
          errors.firstRentalIncomeDate = "Please enter a valid date (YYYY-MM-DD).";
        } else if (availableForRentDate && firstRentalIncomeDate < availableForRentDate) {
          errors.firstRentalIncomeDate = "First Rental Income Date cannot be before the Available for Rent Date.";
        }
      }
    }

    if (status === "Under Renovation") {
      if (!renovationStartDate) {
        errors.renovationStartDate = "Renovation Start Date is required.";
      } else {
        const parts = renovationStartDate.split("-");
        if (parts.length !== 3 || parts[0].length !== 4 || parts[1].length !== 2 || parts[2].length !== 2) {
          errors.renovationStartDate = "Please enter a valid date (YYYY-MM-DD).";
        } else if (purchaseDate && renovationStartDate < purchaseDate) {
          errors.renovationStartDate = "Renovation Start Date cannot be before the Contract Date.";
        }
      }

      if (renovationEndDate) {
        const parts = renovationEndDate.split("-");
        if (parts.length !== 3 || parts[0].length !== 4 || parts[1].length !== 2 || parts[2].length !== 2) {
          errors.renovationEndDate = "Please enter a valid date (YYYY-MM-DD).";
        } else if (renovationStartDate && renovationEndDate < renovationStartDate) {
          errors.renovationEndDate = "Renovation End Date cannot be before the Renovation Start Date.";
        }
      }
    }

    return errors;
  }, [purchaseDate, settlementDate, availableForRentDate, firstRentalIncomeDate, renovationStartDate, renovationEndDate, status]);

  const isBankNameValid = !bankName || /^[a-zA-Z\s]*$/.test(bankName);
  const isBsbValid = !bsbNumber || bsbNumber.length === 6;
  const isLoanAccountNumberValid = !loanAccountNumber || /^\d*$/.test(loanAccountNumber);
  const isLoanAllocationValid = !loanAllocationPercentage || (Number(loanAllocationPercentage) >= 0 && Number(loanAllocationPercentage) <= 100);
  const isLoanAmountValid = isValidCurrency(loanAmount);
  const isEstimatedMarketValueValid = isValidCurrency(estimatedMarketValue);
  const isPurchaseAmountValid = isValidCurrency(purchaseAmount);

  const isLoanDetailsValid =
    isBankNameValid &&
    isBsbValid &&
    isLoanAccountNumberValid &&
    isLoanAllocationValid &&
    isLoanAmountValid;

  const handleLoanAmountChange = (inputVal: string) => {
    if (!inputVal || inputVal === CURRENCY_SYMBOL || inputVal === CURRENCY_SYMBOL.trim()) {
      setLoanAmount("");
      return;
    }
    const formatted = formatAUD(inputVal);
    setLoanAmount(formatted);
  };

  const handleEstimatedMarketValueChange = (inputVal: string) => {
    if (!inputVal || inputVal === CURRENCY_SYMBOL || inputVal === CURRENCY_SYMBOL.trim()) {
      setEstimatedMarketValue("");
      return;
    }
    const formatted = formatAUD(inputVal);
    setEstimatedMarketValue(formatted);
  };

  const handlePurchaseAmountChange = (inputVal: string) => {
    if (!inputVal || inputVal === CURRENCY_SYMBOL || inputVal === CURRENCY_SYMBOL.trim()) {
      setPurchaseAmount("");
      return;
    }
    const formatted = formatAUD(inputVal);
    setPurchaseAmount(formatted);
  };

  const handleDateChange = (
    val: string,
    setter: (v: string) => void,
    limitToToday = false,
  ) => {
    if (!val) {
      setter("");
      return;
    }
    const parts = val.split("-");
    if (parts[0] && parts[0].length > 4) {
      parts[0] = parts[0].slice(0, 4);
      val = parts.join("-");
    }
    setter(val);
  };

  const handleDatePaste = (
    event: ClipboardEvent<HTMLInputElement>,
    setter: (v: string) => void,
    limitToToday = false,
  ) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text");
    const parsed = parseDateString(text);
    if (parsed) {
      setter(parsed);
    }
  };

  const handleDateBlur = (
    val: string,
    setter: (v: string) => void,
    limitToToday = false,
  ) => {
    if (!val) return;
    const parts = val.split("-");
    if (parts[0] && parts[0].length > 4) {
      parts[0] = parts[0].slice(0, 4);
      val = parts.join("-");
    }
    setter(val);
  };

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
    isEstimatedMarketValueValid &&
    purchaseDate &&
    purchaseAmount.trim() &&
    isPurchaseAmountValid &&
    status.trim() &&
    statusDetailsValid &&
    Object.keys(dateErrors).length === 0
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
      setSettlementDate("");
      setEstimatedMarketValue("");
      setPurchaseAmount("");
      return;
    }

    setPropertyName(initialProperty.name);
    setPropertyType(initialProperty.propertyType);
    setLocationText(initialProperty.locationText);
    setEstimatedMarketValue(
      initialProperty.estimatedMarketValue
        ? formatAUD(String(initialProperty.estimatedMarketValue))
        : "",
    );
    setPurchaseDate(initialProperty.purchaseDate);
    setSettlementDate(initialProperty.settlementDate ?? "");
    setPurchaseAmount(
      initialProperty.purchaseAmount
        ? formatAUD(String(initialProperty.purchaseAmount))
        : "",
    );
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
    const initialAmount = getLoanDetail(initialProperty, "loan_amount");
    setLoanAmount(initialAmount ? formatAUD(initialAmount) : "");
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
        documentType: "property_image",
        entityId: entity.id,
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
        documentType: "depreciation_schedule",
        entityId: entity.id,
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
      const cleaned = loanAmount.replace(/[^0-9.]/g, "");
      details.loan_amount = Number.parseFloat(cleaned);
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
        estimated_market_value: estimatedMarketValue.trim()
          ? Number.parseFloat(estimatedMarketValue.replace(/[^0-9.]/g, ""))
          : null,
        purchase_date: purchaseDate,
        settlement_date: settlementDate || null,
        purchase_amount: Number.parseFloat(purchaseAmount.replace(/[^0-9.]/g, "")),
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
              className={`border ${
                touchedFields.propertyName && !propertyName.trim()
                  ? "!border-rose-400 focus:!ring-rose-500/10 focus:!border-rose-500"
                  : ""
              }`}
              onChange={(event) => setPropertyName(event.target.value)}
              onBlur={() => markTouched("propertyName")}
            />
            {touchedFields.propertyName && !propertyName.trim() && (
              <div className="flex items-center gap-1.5 text-rose-600 mt-1 ml-0.5 animate-fadeIn">
                <svg className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <span className="text-[0.78rem] font-medium tracking-tight">Property Name is required.</span>
              </div>
            )}
          </label>

          <div className="property-wizard-grid">
            <div className="entity-wizard-label">
              <span id="property-type-label">
                Property Type <em>*</em>
              </span>
              <div
                className={`property-status-select${isPropertyTypeOpen ? " is-open" : ""
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
                className={`border ${
                  touchedFields.locationText && !locationText.trim()
                    ? "!border-rose-400 focus:!ring-rose-500/10 focus:!border-rose-500"
                    : ""
                }`}
                onChange={(event) => setLocationText(event.target.value)}
                onBlur={() => markTouched("locationText")}
              />
              {touchedFields.locationText && !locationText.trim() && (
                <div className="flex items-center gap-1.5 text-rose-600 mt-1 ml-0.5 animate-fadeIn">
                  <svg className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[0.78rem] font-medium tracking-tight">Property Location is required.</span>
                </div>
              )}
            </label>

            <label className="entity-wizard-label">
              <span>
                Estimated Market Value
              </span>
              <input
                type="text"
                placeholder={`${CURRENCY_SYMBOL}0`}
                value={estimatedMarketValue}
                className={`border ${
                  touchedFields.estimatedMarketValue && !isEstimatedMarketValueValid
                    ? "!border-rose-400 focus:!ring-rose-500/10 focus:!border-rose-500"
                    : ""
                }`}
                onChange={(event) =>
                  handleEstimatedMarketValueChange(event.target.value)
                }
                onBlur={() => markTouched("estimatedMarketValue")}
              />
              {touchedFields.estimatedMarketValue && !isEstimatedMarketValueValid && (
                <div className="flex items-center gap-1.5 text-rose-600 mt-1 ml-0.5 animate-fadeIn">
                  <svg className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[0.78rem] font-medium tracking-tight">Estimated Market Value must accept only currency format ({CURRENCY_SYMBOL.trim()}).</span>
                </div>
              )}
            </label>

            <label className="entity-wizard-label">
              <span>
                Contract Date <em>*</em>
              </span>
              <input
                type="date"
                className={`property-date-input border ${
                  dateErrors.purchaseDate && (touchedFields.purchaseDate || purchaseDate)
                    ? "!border-rose-400 focus:!ring-rose-500/10 focus:!border-rose-500"
                    : ""
                }`}
                max={getTodayString()}
                value={purchaseDate}
                onChange={(event) => handleDateChange(event.target.value, setPurchaseDate, true)}
                onPaste={(event) => handleDatePaste(event, setPurchaseDate, true)}
                onBlur={(event) => {
                  handleDateBlur(event.target.value, setPurchaseDate, true);
                  markTouched("purchaseDate");
                }}
              />
              {dateErrors.purchaseDate && (touchedFields.purchaseDate || purchaseDate) && (
                <div className="flex items-center gap-1.5 text-rose-600 mt-1 ml-0.5 animate-fadeIn">
                  <svg className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[0.78rem] font-medium tracking-tight">{dateErrors.purchaseDate}</span>
                </div>
              )}
            </label>

            <label className="entity-wizard-label">
              <span>
                Settlement Date
              </span>
              <input
                type="date"
                className={`property-date-input border ${
                  dateErrors.settlementDate && (touchedFields.settlementDate || settlementDate)
                    ? "!border-rose-400 focus:!ring-rose-500/10 focus:!border-rose-500"
                    : ""
                }`}
                max="9999-12-31"
                value={settlementDate}
                onChange={(event) => handleDateChange(event.target.value, setSettlementDate, false)}
                onPaste={(event) => handleDatePaste(event, setSettlementDate, false)}
                onBlur={(event) => {
                  handleDateBlur(event.target.value, setSettlementDate, false);
                  markTouched("settlementDate");
                }}
              />
              {dateErrors.settlementDate && (touchedFields.settlementDate || settlementDate) && (
                <div className="flex items-center gap-1.5 text-rose-600 mt-1 ml-0.5 animate-fadeIn">
                  <svg className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[0.78rem] font-medium tracking-tight">{dateErrors.settlementDate}</span>
                </div>
              )}
            </label>

            <label className="entity-wizard-label">
              <span>
                Property Purchase Amount <em>*</em>
              </span>
              <input
                type="text"
                placeholder={`${CURRENCY_SYMBOL}0`}
                value={purchaseAmount}
                className={`border ${
                  touchedFields.purchaseAmount && (!purchaseAmount.trim() || !isPurchaseAmountValid)
                    ? "!border-rose-400 focus:!ring-rose-500/10 focus:!border-rose-500"
                    : ""
                }`}
                onChange={(event) => handlePurchaseAmountChange(event.target.value)}
                onBlur={() => markTouched("purchaseAmount")}
              />
              {touchedFields.purchaseAmount && (!purchaseAmount.trim() || !isPurchaseAmountValid) && (
                <div className="flex items-center gap-1.5 text-rose-600 mt-1 ml-0.5 animate-fadeIn">
                  <svg className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[0.78rem] font-medium tracking-tight">
                    {!purchaseAmount.trim()
                      ? "Property Purchase Amount is required."
                      : `Property Purchase Amount must accept only currency format (${CURRENCY_SYMBOL.trim()}).`}
                  </span>
                </div>
              )}
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
            <div className="property-upload-section">
              <span className="entity-wizard-label-text">
                Depreciation Schedule <em>*</em>
              </span>
              {isUploadingDepreciationSchedule ? (
                <div className="property-upload-progress-card">
                  <div className="property-upload-progress-info">
                    <svg className="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                      <polyline points="13 2 13 9 20 9" />
                    </svg>
                    <div className="progress-details">
                      <span className="filename">Uploading schedule...</span>
                      <span className="progress-percentage">{depreciationUploadProgress}%</span>
                    </div>
                  </div>
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: `${depreciationUploadProgress}%` }} />
                  </div>
                </div>
              ) : depreciationScheduleDocument ? (
                <div className="property-uploaded-card">
                  <div className="uploaded-file-info">
                    <div className="uploaded-preview-wrap document-preview">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="document-icon">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div className="uploaded-details">
                      <span className="filename">{depreciationScheduleDocument.filename || "Depreciation Schedule"}</span>
                      <span className="success-tag">Successfully uploaded</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="remove-uploaded-file"
                    onClick={() => {
                      setDepreciationScheduleDocument(null);
                      setDepreciationUploadProgress(0);
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div
                  className={`property-dropzone ${isDraggingDoc ? "is-dragging" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingDoc(true);
                  }}
                  onDragLeave={() => setIsDraggingDoc(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingDoc(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleDepreciationScheduleUpload(file);
                  }}
                >
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleDepreciationScheduleUpload(file);
                      e.target.value = "";
                    }}
                    id="property-depreciation-input"
                    className="hidden-file-input"
                  />
                  <label htmlFor="property-depreciation-input" className="dropzone-label">
                    <div className="upload-icon-circle">
                      <svg className="upload-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <div className="dropzone-text-group">
                      <span className="dropzone-title">
                        <strong>Click to upload</strong> or drag and drop
                      </span>
                      <span className="dropzone-subtitle">
                        PDF, DOC, DOCX, JPG, or PNG (max. 10MB)
                      </span>
                    </div>
                  </label>
                </div>
              )}
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
                  className={`property-date-input border ${
                    dateErrors.availableForRentDate && (touchedFields.availableForRentDate || availableForRentDate)
                      ? "!border-rose-400 focus:!ring-rose-500/10 focus:!border-rose-500"
                      : ""
                  }`}
                  max="9999-12-31"
                  value={availableForRentDate}
                  onChange={(event) =>
                    handleDateChange(event.target.value, setAvailableForRentDate)
                  }
                  onPaste={(event) => handleDatePaste(event, setAvailableForRentDate)}
                  onBlur={(event) => {
                    handleDateBlur(event.target.value, setAvailableForRentDate);
                    markTouched("availableForRentDate");
                  }}
                />
                {dateErrors.availableForRentDate && (touchedFields.availableForRentDate || availableForRentDate) && (
                  <div className="flex items-center gap-1.5 text-rose-600 mt-1 ml-0.5 animate-fadeIn">
                    <svg className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <span className="text-[0.78rem] font-medium tracking-tight">{dateErrors.availableForRentDate}</span>
                  </div>
                )}
              </label>
              {status === "Rented" && (
                <label className="entity-wizard-label">
                  <span>
                    First Rental Income Date <em>*</em>
                  </span>
                  <input
                    type="date"
                    className={`property-date-input border ${
                      dateErrors.firstRentalIncomeDate && (touchedFields.firstRentalIncomeDate || firstRentalIncomeDate)
                        ? "!border-rose-400 focus:!ring-rose-500/10 focus:!border-rose-500"
                        : ""
                    }`}
                    max="9999-12-31"
                    value={firstRentalIncomeDate}
                    onChange={(event) =>
                      handleDateChange(event.target.value, setFirstRentalIncomeDate)
                    }
                    onPaste={(event) => handleDatePaste(event, setFirstRentalIncomeDate)}
                    onBlur={(event) => {
                      handleDateBlur(event.target.value, setFirstRentalIncomeDate);
                      markTouched("firstRentalIncomeDate");
                    }}
                  />
                  {dateErrors.firstRentalIncomeDate && (touchedFields.firstRentalIncomeDate || firstRentalIncomeDate) && (
                    <div className="flex items-center gap-1.5 text-rose-600 mt-1 ml-0.5 animate-fadeIn">
                      <svg className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      <span className="text-[0.78rem] font-medium tracking-tight">{dateErrors.firstRentalIncomeDate}</span>
                    </div>
                  )}
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
                  className={`property-date-input border ${
                    dateErrors.renovationStartDate && (touchedFields.renovationStartDate || renovationStartDate)
                      ? "!border-rose-400 focus:!ring-rose-500/10 focus:!border-rose-500"
                      : ""
                  }`}
                  max="9999-12-31"
                  value={renovationStartDate}
                  onChange={(event) =>
                    handleDateChange(event.target.value, setRenovationStartDate)
                  }
                  onPaste={(event) => handleDatePaste(event, setRenovationStartDate)}
                  onBlur={(event) => {
                    handleDateBlur(event.target.value, setRenovationStartDate);
                    markTouched("renovationStartDate");
                  }}
                />
                {dateErrors.renovationStartDate && (touchedFields.renovationStartDate || renovationStartDate) && (
                  <div className="flex items-center gap-1.5 text-rose-600 mt-1 ml-0.5 animate-fadeIn">
                    <svg className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <span className="text-[0.78rem] font-medium tracking-tight">{dateErrors.renovationStartDate}</span>
                  </div>
                )}
              </label>
              <label className="entity-wizard-label">
                Renovation End Date <small>(Optional)</small>
                <input
                  type="date"
                  className={`property-date-input border ${
                    dateErrors.renovationEndDate && (touchedFields.renovationEndDate || renovationEndDate)
                      ? "!border-rose-400 focus:!ring-rose-500/10 focus:!border-rose-500"
                      : ""
                  }`}
                  max="9999-12-31"
                  value={renovationEndDate}
                  onChange={(event) => handleDateChange(event.target.value, setRenovationEndDate)}
                  onPaste={(event) => handleDatePaste(event, setRenovationEndDate)}
                  onBlur={(event) => {
                    handleDateBlur(event.target.value, setRenovationEndDate);
                    markTouched("renovationEndDate");
                  }}
                />
                {dateErrors.renovationEndDate && (touchedFields.renovationEndDate || renovationEndDate) && (
                  <div className="flex items-center gap-1.5 text-rose-600 mt-1 ml-0.5 animate-fadeIn">
                    <svg className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <span className="text-[0.78rem] font-medium tracking-tight">{dateErrors.renovationEndDate}</span>
                  </div>
                )}
              </label>
            </div>
          )}

          <div className="property-upload-section">
            <span className="entity-wizard-label-text">
              Property Image <small>(Optional)</small>
            </span>
            {isUploadingPropertyImage ? (
              <div className="property-upload-progress-card">
                <div className="property-upload-progress-info">
                  <svg className="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                    <polyline points="13 2 13 9 20 9" />
                  </svg>
                  <div className="progress-details">
                    <span className="filename">{propertyImageName || "Uploading image..."}</span>
                    <span className="progress-percentage">{propertyImageProgress}%</span>
                  </div>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-bar-fill" style={{ width: `${propertyImageProgress}%` }} />
                </div>
              </div>
            ) : imageUrl ? (
              <div className="property-uploaded-card">
                <div className="uploaded-file-info">
                  {/* <div className="uploaded-preview-wrap">
                    <img src={imageUrl.startsWith('http') || imageUrl.startsWith('/') ? imageUrl : `/api/documents/download?key=${encodeURIComponent(imageUrl)}`} alt="Property Preview" className="uploaded-image-thumbnail" />
                  </div> */}
                  <div className="uploaded-details">
                    <span className="filename">{propertyImageName || "Property Image"}</span>
                    <span className="success-tag">Successfully uploaded</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="remove-uploaded-file"
                  onClick={() => {
                    setImageUrl("");
                    setPropertyImageName("");
                    setPropertyImageProgress(0);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ) : (
              <div
                className={`property-dropzone ${isDraggingImage ? "is-dragging" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingImage(true);
                }}
                onDragLeave={() => setIsDraggingImage(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingImage(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handlePropertyImageUpload(file);
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePropertyImageUpload(file);
                    e.target.value = "";
                  }}
                  id="property-image-input"
                  className="hidden-file-input"
                />
                <label htmlFor="property-image-input" className="dropzone-label">
                  <div className="upload-icon-circle">
                    <svg className="upload-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div className="dropzone-text-group">
                    <span className="dropzone-title">
                      <strong>Click to upload</strong> or drag and drop
                    </span>
                    <span className="dropzone-subtitle">
                      PNG, JPG, JPEG, or WEBP (max. 10MB)
                    </span>
                  </div>
                </label>
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm mt-4 font-medium animate-fadeIn">
              <svg className="w-4 h-4 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="entity-wizard-footer">
            <div />
            <button
              type="button"
              className="entity-wizard-primary"
              disabled={
                isUploadingPropertyImage ||
                isUploadingDepreciationSchedule
              }
              onClick={() => {
                if (!propertyDetailsValid) {
                  setTouchedFields({
                    propertyName: true,
                    locationText: true,
                    estimatedMarketValue: true,
                    purchaseDate: true,
                    settlementDate: true,
                    purchaseAmount: true,
                    availableForRentDate: true,
                    firstRentalIncomeDate: true,
                    renovationStartDate: true,
                    renovationEndDate: true,
                  });
                  setErrorMessage("Please fix the highlighted validation errors before continuing.");
                  return;
                }
                setErrorMessage("");
                setStep(takesOwnershipDetails ? 2 : 3);
              }}
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
            className={`entity-beneficiary-total ${ownershipAboveZero && ownershipWithinLimit ? "is-complete" : ""
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
              onClick={() => {
                setErrorMessage("");
                setStep(1);
              }}
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
              placeholder="e.g., Commonwealth Bank"
              value={bankName}
              onChange={(event) => {
                const cleaned = event.target.value.replace(/[^a-zA-Z\s]/g, "");
                setBankName(cleaned);
              }}
            />
            {!isBankNameValid && (
              <span className="entity-wizard-inline-error">
                Bank Name must contain alphabets only.
              </span>
            )}
          </label>

          <div className="property-wizard-grid">
            <label className="entity-wizard-label">
              BSB Number
              <input
                type="text"
                placeholder="e.g., 123456"
                value={bsbNumber}
                onChange={(event) => {
                  const cleaned = event.target.value.replace(/\D/g, "").slice(0, 6);
                  setBsbNumber(cleaned);
                }}
              />
              {!isBsbValid && (
                <span className="entity-wizard-inline-error">
                  BSB Number must allow exactly 6 digits only.
                </span>
              )}
            </label>

            <label className="entity-wizard-label">
              Loan Account Number
              <input
                type="text"
                placeholder="Enter account number"
                value={loanAccountNumber}
                onChange={(event) => {
                  const cleaned = event.target.value.replace(/\D/g, "");
                  setLoanAccountNumber(cleaned);
                }}
              />
              {!isLoanAccountNumberValid && (
                <span className="entity-wizard-inline-error">
                  Loan Account Number must contain numeric values only.
                </span>
              )}
            </label>

            <label className="entity-wizard-label">
              Loan % Allocation
              <input
                type="number"
                placeholder="0%"
                value={loanAllocationPercentage}
                onChange={(event) => {
                  setLoanAllocationPercentage(event.target.value);
                }}
              />
              {!isLoanAllocationValid && (
                <span className="entity-wizard-inline-error">
                  Loan Allocation percentage must not exceed 100%.
                </span>
              )}
            </label>

            <label className="entity-wizard-label">
              Loan Amount
              <input
                type="text"
                placeholder={`${CURRENCY_SYMBOL}0`}
                value={loanAmount}
                onChange={(event) => handleLoanAmountChange(event.target.value)}
              />
              {!isLoanAmountValid && (
                <span className="entity-wizard-inline-error">
                  Loan Amount must accept only currency format with "{CURRENCY_SYMBOL.trim()}" symbol.
                </span>
              )}
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
                <dd>{estimatedMarketValue.trim() ? toMoney(estimatedMarketValue) : "-"}</dd>
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
              onClick={() => {
                setErrorMessage("");
                setStep(takesOwnershipDetails ? 2 : 1);
              }}
            >
              Back
            </button>
            <button
              type="button"
              className="entity-wizard-primary"
              disabled={
                isSaving ||
                isUploadingPropertyImage ||
                isUploadingDepreciationSchedule ||
                !isLoanDetailsValid
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