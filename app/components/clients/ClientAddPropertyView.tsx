"use client";

import { useEffect, useState, useId, Fragment, useMemo, ClipboardEvent, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSession } from "@/src/lib/session";
import type { CoreEntity, CoreProperty, PropertyType } from "@/src/lib/coreApi";
import { useTheme } from "next-themes";
import { CURRENCY_PREFIX, CURRENCY_SPACER } from "./CurrencyFormatter";


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

];

type BeneficiaryRow = {
  id?: number | null;
  entityBeneficiaryId: number | null;
  name: string;
  percentage: string;
};

type UploadedDocumentRef = {
  documentId: string;
  s3Key: string;
  filename: string;
};

const CURRENCY_SYMBOL = `${CURRENCY_PREFIX}${CURRENCY_SPACER}`;

function titleCase(value: string) {
  if (!value) return "";
  return value
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function isValidCurrency(val: string): boolean {
  if (!val) return true;
  if (val === CURRENCY_SYMBOL || val === CURRENCY_SYMBOL.trim()) return false;
  const escapedSymbol = CURRENCY_SYMBOL.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const pattern = new RegExp(`^${escapedSymbol}\\d{1,3}(,\\d{3})*(\\.\\d{1,2})?$`);
  return pattern.test(val);
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
  let formatted = CURRENCY_SYMBOL + integer;
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

interface ClientAddPropertyViewProps {
  mode?: "create" | "edit";
  propertyId?: string;
  initialProperty?: CoreProperty;
  backUrl?: string;
  backText?: string;
  entityId?: string;
  onSuccessUrl?: string;
}

export default function ClientAddPropertyView({
  mode = "create",
  propertyId,
  initialProperty: propInitialProperty,
  backUrl: propBackUrl,
  backText: propBackText,
  entityId,
  onSuccessUrl = "/dashboard/client/properties",
}: ClientAddPropertyViewProps = {}) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const isDark = mounted && theme === "dark";


  const router = useRouter();
  const [backUrl, setBackUrl] = useState(propBackUrl || "/dashboard/client/properties");
  const [backText, setBackText] = useState(propBackText || "Properties");

  useEffect(() => {
    if (propBackUrl) {
      setBackUrl(propBackUrl);
    }
    if (propBackText) {
      setBackText(propBackText);
    }

    if (!propBackUrl || !propBackText) {
      if (typeof window !== "undefined" && window.sessionStorage) {
        const prevPath = sessionStorage.getItem("prevDashboardPath");
        if (prevPath) {
          const normalized = prevPath.split("?")[0].split("#")[0];
          if (!propBackUrl) {
            if (normalized.startsWith("/dashboard/client")) {
              setBackUrl(prevPath);
            }
          }
          if (!propBackText) {
            if (normalized === "/dashboard/client" || normalized === "/dashboard/client/summary" || normalized === "/dashboard/client/detailed") {
              setBackText("Dashboard");
            } else if (normalized === "/dashboard/client/properties") {
              setBackText("Properties");
            } else if (normalized === "/dashboard/client/entities") {
              setBackText("Entities");
            } else if (normalized.match(/^\/dashboard\/client\/entities\/[^/]+$/)) {
              setBackText("Entity");
            } else if (normalized.match(/^\/dashboard\/client\/properties\/[^/]+$/)) {
              setBackText("Property");
            } else if (normalized === "/dashboard/client/transactions") {
              setBackText("Transactions");
            } else if (normalized === "/dashboard/client/insights") {
              setBackText("Insights");
            } else if (normalized === "/dashboard/client/profile") {
              setBackText("Profile");
            } else if (normalized.startsWith("/dashboard/client")) {
              setBackText("Back");
            }
          }
        }
      }
    }
  }, [propBackUrl, propBackText]);

  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [entities, setEntities] = useState<CoreEntity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState(entityId ?? "");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (entityId) {
      setSelectedEntityId(entityId);
    }
  }, [entityId]);

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
  const [hasLoan, setHasLoan] = useState(false);
  const [bankName, setBankName] = useState("");
  const [bsbNumber, setBsbNumber] = useState("");
  const [loanAccountNumber, setLoanAccountNumber] = useState("");
  const [loanAllocationPercentage, setLoanAllocationPercentage] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  const [initialProperty, setInitialProperty] = useState<CoreProperty | undefined>(propInitialProperty);

  const markTouched = (field: string) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [isEntityOpen, setIsEntityOpen] = useState(false);
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);

  const entityDropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isEntityOpen &&
        entityDropdownRef.current &&
        !entityDropdownRef.current.contains(event.target as Node)
      ) {
        setIsEntityOpen(false);
      }
      if (
        isTypeOpen &&
        typeDropdownRef.current &&
        !typeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTypeOpen(false);
      }
      if (
        isStatusOpen &&
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(event.target as Node)
      ) {
        setIsStatusOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEntityOpen, isTypeOpen, isStatusOpen]);

  const entityDropdownId = `entity-dropdown-${useId()}`;
  const typeDropdownId = `type-dropdown-${useId()}`;
  const statusDropdownId = `status-dropdown-${useId()}`;

  useEffect(() => {
    if (propInitialProperty) {
      setInitialProperty(propInitialProperty);
    }
  }, [propInitialProperty]);

  useEffect(() => {
    if (mode === "edit" && propertyId && !propInitialProperty) {
      const activeId = propertyId;
      async function fetchProperty() {
        try {
          const session = (await getSession()) as SessionWithIdToken | null;
          if (!session) {
            router.replace("/login/user");
            return;
          }
          const token = session.getIdToken().getJwtToken();
          const res = await fetch(`/api/properties/${encodeURIComponent(activeId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setInitialProperty(data);
          }
        } catch (err) {
          console.error("Failed to load property:", err);
        }
      }
      fetchProperty();
    }
  }, [mode, propertyId, propInitialProperty, router]);

  useEffect(() => {
    if (!initialProperty) return;

    setPropertyName(initialProperty.name);
    setPropertyType(initialProperty.propertyType);
    setLocationText(initialProperty.locationText);
    setEstimatedMarketValue(
      initialProperty.estimatedMarketValue
        ? formatAUD(String(initialProperty.estimatedMarketValue))
        : "",
    );
    setPurchaseDate(initialProperty.purchaseDate);
    setPurchaseAmount(
      initialProperty.purchaseAmount
        ? formatAUD(String(initialProperty.purchaseAmount))
        : "",
    );
    setHasDepreciationSchedule(initialProperty.hasDepreciationSchedule);
    setStatus(initialProperty.status || "Self Occupied");
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

    if (initialProperty.entityId) {
      setSelectedEntityId(initialProperty.entityId);
    }

    setHasLoan(
      !!(
        getLoanDetail(initialProperty, "bank_name") ||
        getLoanDetail(initialProperty, "bsb_number") ||
        getLoanDetail(initialProperty, "loan_account_number") ||
        getLoanDetail(initialProperty, "loan_allocation_percentage") ||
        getLoanDetail(initialProperty, "loan_amount")
      ),
    );
    setBankName(getLoanDetail(initialProperty, "bank_name"));
    setBsbNumber(getLoanDetail(initialProperty, "bsb_number"));
    setLoanAccountNumber(getLoanDetail(initialProperty, "loan_account_number"));
    setLoanAllocationPercentage(
      getLoanDetail(initialProperty, "loan_allocation_percentage"),
    );
    const initialAmount = getLoanDetail(initialProperty, "loan_amount");
    setLoanAmount(initialAmount ? formatAUD(initialAmount) : "");
  }, [initialProperty]);

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
            if (!selectedEntityId) {
              setSelectedEntityId(items[0].id);
            }
          } else {
            setEntities(demoEntities);
            if (!selectedEntityId) {
              setSelectedEntityId(demoEntities[0].id);
            }
          }
        } else {
          setEntities(demoEntities);
          if (!selectedEntityId) {
            setSelectedEntityId(demoEntities[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load entities", err);
        setEntities(demoEntities);
        if (!selectedEntityId) {
          setSelectedEntityId(demoEntities[0].id);
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [router, selectedEntityId]);

  // Update beneficiaries when selected entity changes
  useEffect(() => {
    const activeEntity = entities.find((e) => e.id === selectedEntityId);
    if (activeEntity) {
      const initialRows = activeEntity.beneficiaries.map((b) => {
        const savedOwner = (initialProperty && initialProperty.entityId === selectedEntityId)
          ? initialProperty.owners.find((owner) => owner.entityBeneficiaryId === b.id)
          : null;

        return {
          id: savedOwner?.id ?? null,
          entityBeneficiaryId: b.id ?? null,
          name: savedOwner?.ownerName || b.name,
          percentage: String(
            savedOwner?.ownershipPercentage ??
            b.ownershipPercentage ??
            "",
          ),
        };
      });
      setBeneficiaries(initialRows);
    } else {
      setBeneficiaries([]);
    }
  }, [selectedEntityId, entities, initialProperty]);

  const selectedEntity = entities.find((e) => e.id === selectedEntityId);
  const takesOwnershipDetails = selectedEntity?.entityType === "individual";

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
  ) => {
    if (!val) return;
    const parts = val.split("-");
    if (parts[0] && parts[0].length > 4) {
      parts[0] = parts[0].slice(0, 4);
      val = parts.join("-");
    }
    setter(val);
  };

  const dateErrors = useMemo(() => {
    const errors: {
      purchaseDate?: string;
      availableForRentDate?: string;
      firstRentalIncomeDate?: string;
      renovationStartDate?: string;
      renovationEndDate?: string;
    } = {};

    const today = getTodayString();

    if (purchaseDate) {
      const parts = purchaseDate.split("-");
      if (parts.length !== 3 || parts[0].length !== 4 || parts[1].length !== 2 || parts[2].length !== 2) {
        errors.purchaseDate = "Please enter a valid date (YYYY-MM-DD).";
      } else if (purchaseDate > today) {
        errors.purchaseDate = "Contract Date cannot be in the future.";
      }
    }

    if (status === "Available for Rent" || status === "Rented") {
      if (availableForRentDate) {
        const parts = availableForRentDate.split("-");
        if (parts.length !== 3 || parts[0].length !== 4 || parts[1].length !== 2 || parts[2].length !== 2) {
          errors.availableForRentDate = "Please enter a valid date (YYYY-MM-DD).";
        } else if (purchaseDate && availableForRentDate < purchaseDate) {
          errors.availableForRentDate = "Available for Rent Date cannot be before the Contract Date.";
        } else if (availableForRentDate < today) {
          errors.availableForRentDate = "Available for Rent Date must be today or in the future.";
        }
      }
    }

    if (status === "Rented") {
      if (firstRentalIncomeDate) {
        const parts = firstRentalIncomeDate.split("-");
        if (parts.length !== 3 || parts[0].length !== 4 || parts[1].length !== 2 || parts[2].length !== 2) {
          errors.firstRentalIncomeDate = "Please enter a valid date (YYYY-MM-DD).";
        } else if (availableForRentDate && firstRentalIncomeDate < availableForRentDate) {
          errors.firstRentalIncomeDate = "First Rental Income Date cannot be before the Available for Rent Date.";
        } else if (purchaseDate && firstRentalIncomeDate < purchaseDate) {
          errors.firstRentalIncomeDate = "First Rental Income Date cannot be before the Contract Date.";
        }
      }
    }

    if (status === "Under Renovation") {
      if (renovationStartDate) {
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
  }, [purchaseDate, availableForRentDate, firstRentalIncomeDate, renovationStartDate, renovationEndDate, status]);

  // Field validations
  const isEstimatedMarketValueValid = useMemo(() => {
    if (!estimatedMarketValue) return true;
    if (!isValidCurrency(estimatedMarketValue)) return false;
    const num = Number.parseFloat(estimatedMarketValue.replace(/[^0-9.-]/g, ""));
    return !isNaN(num) && num > 0;
  }, [estimatedMarketValue]);

  const isPurchaseAmountValid = useMemo(() => {
    if (!purchaseAmount) return true;
    if (!isValidCurrency(purchaseAmount)) return false;
    const num = Number.parseFloat(purchaseAmount.replace(/[^0-9.-]/g, ""));
    return !isNaN(num) && num > 0;
  }, [purchaseAmount]);
  const isBankNameValid = !hasLoan || (!!bankName.trim() && /^[a-zA-Z\s]+$/.test(bankName));
  const isBsbValid = !hasLoan || (!!bsbNumber.trim() && bsbNumber.trim().length === 6);
  const isLoanAccountNumberValid = !hasLoan || (!!loanAccountNumber.trim() && /^\d+$/.test(loanAccountNumber.trim()));
  const isLoanAllocationValid = !hasLoan || (!!loanAllocationPercentage.trim() && Number(loanAllocationPercentage) > 0 && Number(loanAllocationPercentage) <= 100);
  const isLoanAmountValid = useMemo(() => {
    if (!hasLoan) return true;
    if (!loanAmount.trim()) return false;
    if (!isValidCurrency(loanAmount)) return false;
    const num = Number.parseFloat(loanAmount.replace(/[^0-9.-]/g, ""));
    return !isNaN(num) && num > 0;
  }, [hasLoan, loanAmount]);

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

  const isEveryBeneficiaryValid = beneficiaries.every((b) => {
    const val = Number.parseFloat(b.percentage);
    return b.name.trim() !== "" && !isNaN(val) && val > 0;
  });

  const ownersValid =
    !takesOwnershipDetails ||
    (beneficiaries.length > 0 && totalOwnership > 0 && totalOwnership <= 100 && isEveryBeneficiaryValid);

  const isStep1Valid =
    Boolean(selectedEntityId) &&
    Boolean(propertyName.trim()) &&
    Boolean(locationText.trim()) &&
    locationText.length <= 500 &&
    Boolean(propertyType) &&
    Boolean(status) &&
    (status === "Available for Rent"
      ? Boolean(availableForRentDate) && !dateErrors.availableForRentDate
      : status === "Rented"
        ? Boolean(availableForRentDate && firstRentalIncomeDate) && !dateErrors.availableForRentDate && !dateErrors.firstRentalIncomeDate
        : status === "Under Renovation"
          ? Boolean(renovationStartDate) && !dateErrors.renovationStartDate && !dateErrors.renovationEndDate
          : true);

  const isStep2Valid =
    Boolean(estimatedMarketValue) &&
    isEstimatedMarketValueValid &&
    Boolean(purchaseAmount) &&
    isPurchaseAmountValid &&
    Boolean(purchaseDate) &&
    !dateErrors.purchaseDate &&
    (!hasDepreciationSchedule || Boolean(depreciationScheduleDocument)) &&
    ownersValid;

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
    let sanitizedValue = value;
    if (field === "percentage") {
      sanitizedValue = value.replace(/[-eE+]/g, "");
    } else if (field === "name") {
      sanitizedValue = value.replace(/[0-9]/g, "");
    }
    setBeneficiaries((current) =>
      current.map((row, i) => {
        if (i !== idx) return row;
        return {
          ...row,
          [field]: sanitizedValue,
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
      if (hasLoan && !isLoanDetailsValid) {
        setTouchedFields((prev) => ({
          ...prev,
          bankName: true,
          bsbNumber: true,
          loanAccountNumber: true,
          loanAllocationPercentage: true,
          loanAmount: true,
        }));
      }
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

      if (hasLoan) {
        if (bankName.trim()) loanDetails.bank_name = bankName.trim();
        if (bsbNumber.trim()) loanDetails.bsb_number = bsbNumber.trim();
        if (loanAccountNumber.trim()) loanDetails.loan_account_number = loanAccountNumber.trim();
        if (loanAllocationPercentage.trim()) {
          loanDetails.loan_allocation_percentage = Number.parseFloat(loanAllocationPercentage);
        }
        if (loanAmount.trim()) {
          loanDetails.loan_amount = Number.parseFloat(loanAmount.replace(/[^0-9.]/g, ""));
        }
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
        loan_details: loanDetails,
      };

      if (takesOwnershipDetails) {
        body.owners = beneficiaries.map((b) => ({
          ...(b.id ? { id: b.id } : {}),
          entity_beneficiary_id: b.entityBeneficiaryId,
          owner_name: b.name.trim(),
          ownership_percentage: Number.parseFloat(b.percentage),
        }));
      }

      if (imageUrl.trim()) {
        body.image_url = imageUrl.trim();
      }

      const url = mode === "edit" && propertyId
        ? `/api/properties/${encodeURIComponent(propertyId)}`
        : `/api/entities/${selectedEntityId}/properties`;

      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || data?.message || `Failed to ${mode === "edit" ? "update" : "create"} property.`);
      }

      setSaved(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : `Failed to ${mode === "edit" ? "update" : "add"} property.`);
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
      router.push(backUrl);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      const target = e.target as HTMLElement;
      if (target && target.tagName === "INPUT") {
        const inputType = target.getAttribute("type");
        if (inputType === "checkbox" || inputType === "radio" || inputType === "file") {
          return;
        }

        e.preventDefault();

        if (isMobile) {
          if (step === 1 && isStep1Valid) {
            setStep(2);
          } else if (step === 2 && isStep2Valid) {
            setStep(3);
          } else if (step === 3 && isStep2Valid && isLoanDetailsValid && !isSaving) {
            handleSave();
          }
        } else {
          if (step === 1 && isStep1Valid) {
            setStep(2);
          } else if (step >= 2 && isStep2Valid && isLoanDetailsValid && !isSaving) {
            handleSave();
          }
        }
      }
    }
  };

  if (isLoading) {
    const skeletonBg = isDark ? "rgba(255, 255, 255, 0.08)" : "#eaeef4";
    return (
      <div 
        style={{ 
          background: isDark ? "var(--surface-0)" : "#f7f9fc", 
          color: isDark ? "var(--text-primary)" : "inherit", 
          minHeight: "100vh", 
          padding: isMobile ? "20px" : "40px", 
          fontFamily: '"Inter", sans-serif' 
        }}
      >
        <style>{`
          @keyframes skeleton-pulse {
            0% { opacity: 0.6; }
            50% { opacity: 1; }
            100% { opacity: 0.6; }
          }
          .skeleton-pulse {
            animation: skeleton-pulse 1.5s infinite ease-in-out;
          }
        `}</style>

        {/* Back Link / Title Area */}
        <div style={{ marginBottom: "24px" }}>
          {/* Breadcrumb line */}
          <div className="skeleton-pulse" style={{ width: "150px", height: "14px", background: skeletonBg, borderRadius: "4px", marginBottom: "12px" }} />
          {/* Title line */}
          <div className="skeleton-pulse" style={{ width: "280px", height: "36px", background: skeletonBg, borderRadius: "6px", marginBottom: "8px" }} />
          {/* Subtitle line */}
          <div className="skeleton-pulse" style={{ width: "420px", height: "16px", background: skeletonBg, borderRadius: "4px" }} />
        </div>

        {/* Main Card */}
        <div 
          style={{ 
            background: isDark ? "var(--surface-1)" : "#ffffff", 
            borderRadius: "16px", 
            border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, 
            padding: isMobile ? "20px" : "32px", 
            boxShadow: isDark ? "none" : "0px 8px 30px rgba(16, 24, 40, 0.02)" 
          }}
        >
          {/* Step Indicator */}
          <div className="skeleton-pulse" style={{ width: "180px", height: "12px", background: skeletonBg, borderRadius: "4px", marginBottom: "28px" }} />

          {/* Image Dropzone Skeleton */}
          <div style={{ marginBottom: "28px" }}>
            <div className="skeleton-pulse" style={{ width: "120px", height: "14px", background: skeletonBg, borderRadius: "4px", marginBottom: "8px" }} />
            <div className="skeleton-pulse" style={{ height: "120px", background: isDark ? "var(--surface-2)" : "#f8f9fc", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, borderRadius: "12px" }} />
          </div>

          {/* Form Fields Grid */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
            {/* Entity Name Field */}
            <div>
              <div className="skeleton-pulse" style={{ width: "100px", height: "14px", background: skeletonBg, borderRadius: "4px", marginBottom: "8px" }} />
              <div className="skeleton-pulse" style={{ height: "44px", background: isDark ? "var(--surface-2)" : "#f8f9fc", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, borderRadius: "8px" }} />
            </div>

            {/* Property Name Field */}
            <div>
              <div className="skeleton-pulse" style={{ width: "110px", height: "14px", background: skeletonBg, borderRadius: "4px", marginBottom: "8px" }} />
              <div className="skeleton-pulse" style={{ height: "44px", background: isDark ? "var(--surface-2)" : "#f8f9fc", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, borderRadius: "8px" }} />
            </div>

            {/* Location Field */}
            <div style={{ gridColumn: isMobile ? "span 1" : "span 2" }}>
              <div className="skeleton-pulse" style={{ width: "120px", height: "14px", background: skeletonBg, borderRadius: "4px", marginBottom: "8px" }} />
              <div className="skeleton-pulse" style={{ height: "44px", background: isDark ? "var(--surface-2)" : "#f8f9fc", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, borderRadius: "8px" }} />
            </div>

            {/* Property Type Field */}
            <div>
              <div className="skeleton-pulse" style={{ width: "100px", height: "14px", background: skeletonBg, borderRadius: "4px", marginBottom: "8px" }} />
              <div className="skeleton-pulse" style={{ height: "44px", background: isDark ? "var(--surface-2)" : "#f8f9fc", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, borderRadius: "8px" }} />
            </div>

            {/* Status Field */}
            <div>
              <div className="skeleton-pulse" style={{ width: "90px", height: "14px", background: skeletonBg, borderRadius: "4px", marginBottom: "8px" }} />
              <div className="skeleton-pulse" style={{ height: "44px", background: isDark ? "var(--surface-2)" : "#f8f9fc", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, borderRadius: "8px" }} />
            </div>
          </div>

          {/* Footer buttons skeleton */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "32px", borderTop: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, paddingTop: "20px" }}>
            <div className="skeleton-pulse" style={{ width: "120px", height: "44px", background: skeletonBg, borderRadius: "8px" }} />
          </div>
        </div>
      </div>
    );
  }

  // --- MOBILE RENDER FUNCTION (figma matching) ---
  const renderMobileView = () => {
    const isCurrentStepValid = step === 1 ? isStep1Valid : step === 2 ? isStep2Valid : (isStep2Valid && isLoanDetailsValid);

    return (
      <div 
        onKeyDown={handleKeyDown}
        style={{ background: isDark ? "var(--surface-0)" : "#ffffff", color: isDark ? "var(--text-primary)" : "inherit", minHeight: "100vh", paddingBottom: "90px", display: "flex", flexDirection: "column", fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
      >
        {/* Top Header */}
        <div style={{
          position: "sticky",
          top: 0,
          background: isDark ? "var(--surface-1)" : "#ffffff",
          borderBottom: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
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
              color: isDark ? "var(--accent)" : "#2f3c82",
              cursor: "pointer",
              padding: 0
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "18px", height: "18px" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            {step === 1 ? backText : "Back"}
          </button>

          <div style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "18px",
            fontWeight: 700,
            color: isDark ? "var(--text-primary)" : "#101828"
          }}>
            Add Property
          </div>
          <div style={{ width: "60px" }} />
        </div>

        {/* Step Info Banner */}
        <div style={{
          background: isDark ? "var(--surface-2)" : "#f4f6fc",
          padding: "14px 16px",
          textAlign: "center",
          fontSize: "14px",
          fontWeight: 600,
          color: isDark ? "var(--text-primary)" : "#2f3c82",
          borderBottom: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`
        }}>
          Enter the below values to complete the step
        </div>

        {/* Main Content Area */}
        <div style={{ padding: "24px 20px", flex: 1 }}>
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Property Image */}
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#1e293b", marginBottom: "8px" }}>
                  Property Image
                </label>

                {isUploadingPropertyImage ? (
                  <div style={{ border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, borderRadius: "12px", padding: "16px", display: "flex", alignItems: "center", gap: "12px", background: isDark ? "var(--surface-2)" : "#f8f9fc" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 500, color: isDark ? "var(--text-primary)" : "#344054", marginBottom: "4px" }}>
                        <span>Uploading...</span>
                        <span>{propertyImageProgress}%</span>
                      </div>
                      <div style={{ height: "6px", width: "100%", background: isDark ? "var(--surface-1)" : "#eaeef4", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${propertyImageProgress}%`, background: isDark ? "var(--accent)" : "#2f3c82" }} />
                      </div>
                    </div>
                  </div>
                ) : imageUrl ? (
                  <div style={{ border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, borderRadius: "12px", padding: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", background: isDark ? "var(--surface-2)" : "#f8f9fc" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <img
                        src={imageUrl.startsWith("http") || imageUrl.startsWith("/") ? imageUrl : `/api/documents/download?key=${encodeURIComponent(imageUrl)}`}
                        alt="Preview"
                        style={{ width: "40px", height: "40px", borderRadius: "8px", objectFit: "cover", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}` }}
                      />
                      <span style={{ fontSize: "13px", fontWeight: 600, color: isDark ? "var(--text-primary)" : "#344054" }}>Image added</span>
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
                      border: `1px dashed ${isDark ? "var(--border)" : "#eaeef4"}`,
                      background: isDark ? "var(--surface-2)" : "#f4f6fa",
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
                    <div style={{ fontSize: "14px", fontWeight: 600, color: isDark ? "var(--text-secondary)" : "#718096", marginBottom: "4px" }}>
                      Tap to add property photo
                    </div>
                    <div style={{ fontSize: "11px", color: isDark ? "var(--text-muted)" : "#a0aec0" }}>
                      JPEG, PNG max 10 MB<br />Camera or Gallery
                    </div>
                  </div>
                )}
              </div>

              {/* Entity name */}
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#1e293b", marginBottom: "8px" }}>
                  Entity Name <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <div ref={entityDropdownRef} style={{ position: "relative", zIndex: isEntityOpen ? 30 : 1 }}>
                  <button
                    type="button"
                    disabled={mode === "edit" || !!entityId}
                    onClick={() => mode !== "edit" && !entityId && setIsEntityOpen(!isEntityOpen)}
                    style={{
                      width: "100%",
                      height: "48px",
                      padding: "0 16px",
                      background: (mode === "edit" || !!entityId)
                        ? (isDark ? "var(--surface-1)" : "#f1f5f9")
                        : (isDark ? "var(--surface-2)" : "#f4f6fa"),
                      border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                      borderRadius: "12px",
                      fontSize: "14px",
                      color: selectedEntityId ? (isDark ? "var(--text-primary)" : "#101828") : (isDark ? "var(--text-muted)" : "#94a3b8"),
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: (mode === "edit" || !!entityId) ? "not-allowed" : "pointer",
                      fontWeight: 500,
                      opacity: (mode === "edit" || !!entityId) ? 0.7 : 1
                    }}
                  >
                    <span>{selectedEntity ? selectedEntity.name : "Select Entity"}</span>
                    {mode !== "edit" && !entityId && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="#667085" strokeWidth="2" style={{ width: "16px", height: "16px", transform: isEntityOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    )}
                  </button>
                  {isEntityOpen && mode !== "edit" && !entityId && (
                    <div style={{ position: "absolute", top: "52px", left: 0, right: 0, background: isDark ? "var(--surface-1)" : "#ffffff", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, borderRadius: "12px", boxShadow: isDark ? "none" : "0px 8px 30px rgba(16, 24, 40, 0.08)", zIndex: 120, maxHeight: "180px", overflowY: "auto" }}>
                      {entities.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => { setSelectedEntityId(e.id); setIsEntityOpen(false); }}
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            textAlign: "left",
                            background: selectedEntityId === e.id ? (isDark ? "var(--surface-2)" : "#f4f6fc") : "transparent",
                            border: "none",
                            fontSize: "14px",
                            color: isDark ? "var(--text-primary)" : "#101828",
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
                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#1e293b", marginBottom: "8px" }}>
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
                    background: isDark ? "var(--surface-2)" : "#f4f6fa",
                    border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                    borderRadius: "12px",
                    fontSize: "14px",
                    color: isDark ? "var(--text-primary)" : "#101828",
                    outline: "none"
                  }}
                />
              </div>

              {/* Property Location */}
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#1e293b", marginBottom: "8px" }}>
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
                    background: isDark ? "var(--surface-2)" : "#f4f6fa",
                    border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                    borderRadius: "12px",
                    fontSize: "14px",
                    color: isDark ? "var(--text-primary)" : "#101828",
                    outline: "none"
                  }}
                />
              </div>

              {/* Property Type */}
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#1e293b", marginBottom: "8px" }}>
                  Property Type <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <div ref={typeDropdownRef} style={{ position: "relative", zIndex: isTypeOpen ? 30 : 1 }}>
                  <button
                    type="button"
                    onClick={() => setIsTypeOpen(!isTypeOpen)}
                    style={{
                      width: "100%",
                      height: "48px",
                      padding: "0 16px",
                      background: isDark ? "var(--surface-2)" : "#f4f6fa",
                      border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                      borderRadius: "12px",
                      fontSize: "14px",
                      color: propertyType ? (isDark ? "var(--text-primary)" : "#101828") : (isDark ? "var(--text-muted)" : "#94a3b8"),
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
                    <div style={{ position: "absolute", top: "52px", left: 0, right: 0, background: isDark ? "var(--surface-1)" : "#ffffff", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, borderRadius: "12px", boxShadow: isDark ? "none" : "0px 8px 30px rgba(16, 24, 40, 0.08)", zIndex: 120 }}>
                      {propertyTypeOptions.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => { setPropertyType(o.value); setIsTypeOpen(false); }}
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            textAlign: "left",
                            background: propertyType === o.value ? (isDark ? "var(--surface-2)" : "#f4f6fc") : "transparent",
                            border: "none",
                            fontSize: "14px",
                            color: isDark ? "var(--text-primary)" : "#101828",
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
                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#1e293b", marginBottom: "8px" }}>
                  Property Status <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <div ref={statusDropdownRef} style={{ position: "relative", zIndex: isStatusOpen ? 30 : 1 }}>
                  <button
                    type="button"
                    onClick={() => setIsStatusOpen(!isStatusOpen)}
                    style={{
                      width: "100%",
                      height: "48px",
                      padding: "0 16px",
                      background: isDark ? "var(--surface-2)" : "#f4f6fa",
                      border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                      borderRadius: "12px",
                      fontSize: "14px",
                      color: status ? (isDark ? "var(--text-primary)" : "#101828") : (isDark ? "var(--text-muted)" : "#94a3b8"),
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
                    <div style={{ position: "absolute", top: "52px", left: 0, right: 0, background: isDark ? "var(--surface-1)" : "#ffffff", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, borderRadius: "12px", boxShadow: isDark ? "none" : "0px 8px 30px rgba(16, 24, 40, 0.08)", zIndex: 120, maxHeight: "180px", overflowY: "auto" }}>
                      {propertyStatusOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => { setStatus(opt); setIsStatusOpen(false); }}
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            textAlign: "left",
                            background: status === opt ? (isDark ? "var(--surface-2)" : "#f4f6fc") : "transparent",
                            border: "none",
                            fontSize: "14px",
                            color: isDark ? "var(--text-primary)" : "#101828",
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
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "14px", background: isDark ? "var(--surface-1)" : "#f8f9fc", borderRadius: "12px", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}` }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#475569", marginBottom: "6px" }}>
                      Available for Rent Date <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <input
                      type="date"
                      max="9999-12-31"
                      value={availableForRentDate}
                      onChange={(e) => handleDateChange(e.target.value, setAvailableForRentDate)}
                      onPaste={(e) => handleDatePaste(e, setAvailableForRentDate)}
                      onBlur={(e) => {
                        handleDateBlur(e.target.value, setAvailableForRentDate);
                        markTouched("availableForRentDate");
                      }}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 12px",
                        background: isDark ? "var(--surface-2)" : "#ffffff",
                        border: touchedFields.availableForRentDate && dateErrors.availableForRentDate ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                        borderRadius: "8px",
                        fontSize: "13px",
                        color: isDark ? "var(--text-primary)" : "#101828"
                      }}
                    />
                    {dateErrors.availableForRentDate && (touchedFields.availableForRentDate || availableForRentDate) && (
                      <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                        {dateErrors.availableForRentDate}
                      </div>
                    )}
                  </div>
                  {status === "Rented" && (
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#475569", marginBottom: "6px" }}>
                        First Rental Income Date <span style={{ color: "#EF4444" }}>*</span>
                      </label>
                      <input
                        type="date"
                        max="9999-12-31"
                        value={firstRentalIncomeDate}
                        onChange={(e) => handleDateChange(e.target.value, setFirstRentalIncomeDate)}
                        onPaste={(e) => handleDatePaste(e, setFirstRentalIncomeDate)}
                        onBlur={(e) => {
                          handleDateBlur(e.target.value, setFirstRentalIncomeDate);
                          markTouched("firstRentalIncomeDate");
                        }}
                        style={{
                          width: "100%",
                          height: "44px",
                          padding: "0 12px",
                          background: isDark ? "var(--surface-2)" : "#ffffff",
                          border: touchedFields.firstRentalIncomeDate && dateErrors.firstRentalIncomeDate ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                          borderRadius: "8px",
                          fontSize: "13px",
                          color: isDark ? "var(--text-primary)" : "#101828"
                        }}
                      />
                      {dateErrors.firstRentalIncomeDate && (touchedFields.firstRentalIncomeDate || firstRentalIncomeDate) && (
                        <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                          {dateErrors.firstRentalIncomeDate}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {status === "Under Renovation" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "14px", background: isDark ? "var(--surface-1)" : "#f8f9fc", borderRadius: "12px", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}` }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#475569", marginBottom: "6px" }}>
                      Renovation Start Date <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <input
                      type="date"
                      max="9999-12-31"
                      value={renovationStartDate}
                      onChange={(e) => handleDateChange(e.target.value, setRenovationStartDate)}
                      onPaste={(e) => handleDatePaste(e, setRenovationStartDate)}
                      onBlur={(e) => {
                        handleDateBlur(e.target.value, setRenovationStartDate);
                        markTouched("renovationStartDate");
                      }}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 12px",
                        background: isDark ? "var(--surface-2)" : "#ffffff",
                        border: touchedFields.renovationStartDate && dateErrors.renovationStartDate ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                        borderRadius: "8px",
                        fontSize: "13px",
                        color: isDark ? "var(--text-primary)" : "#101828"
                      }}
                    />
                    {dateErrors.renovationStartDate && (touchedFields.renovationStartDate || renovationStartDate) && (
                      <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                        {dateErrors.renovationStartDate}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#475569", marginBottom: "6px" }}>
                      Renovation End Date <small style={{ color: isDark ? "var(--text-muted)" : "#667085" }}>(Optional)</small>
                    </label>
                    <input
                      type="date"
                      max="9999-12-31"
                      value={renovationEndDate}
                      onChange={(e) => handleDateChange(e.target.value, setRenovationEndDate)}
                      onPaste={(e) => handleDatePaste(e, setRenovationEndDate)}
                      onBlur={(e) => {
                        handleDateBlur(e.target.value, setRenovationEndDate);
                        markTouched("renovationEndDate");
                      }}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 12px",
                        background: isDark ? "var(--surface-2)" : "#ffffff",
                        border: touchedFields.renovationEndDate && dateErrors.renovationEndDate ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                        borderRadius: "8px",
                        fontSize: "13px",
                        color: isDark ? "var(--text-primary)" : "#101828"
                      }}
                    />
                    {dateErrors.renovationEndDate && (touchedFields.renovationEndDate || renovationEndDate) && (
                      <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                        {dateErrors.renovationEndDate}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ fontSize: "11px", fontWeight: 800, color: isDark ? "var(--text-secondary)" : "#64748b", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                FINANCIAL INFO
              </div>

              {/* Market and Purchase Value */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#1e293b", marginBottom: "8px" }}>
                    Market Value <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder={`${CURRENCY_SYMBOL}0`}
                    value={estimatedMarketValue}
                    onChange={(e) => handleEstimatedMarketValueChange(e.target.value)}
                    onBlur={() => markTouched("estimatedMarketValue")}
                    style={{
                      width: "100%",
                      height: "48px",
                      padding: "0 16px",
                      background: isDark ? "var(--surface-2)" : "#f4f6fa",
                      border: touchedFields.estimatedMarketValue && !isEstimatedMarketValueValid ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                      borderRadius: "12px",
                      fontSize: "14px",
                      color: isDark ? "var(--text-primary)" : "#101828",
                      outline: "none"
                    }}
                  />
                  {touchedFields.estimatedMarketValue && !isEstimatedMarketValueValid && (
                    <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                      Market Value must be greater than 0 and in currency format ({CURRENCY_PREFIX}).
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#1e293b", marginBottom: "8px" }}>
                    Purchase Value <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder={`${CURRENCY_SYMBOL}0`}
                    value={purchaseAmount}
                    onChange={(e) => handlePurchaseAmountChange(e.target.value)}
                    onBlur={() => markTouched("purchaseAmount")}
                    style={{
                      width: "100%",
                      height: "48px",
                      padding: "0 16px",
                      background: isDark ? "var(--surface-2)" : "#f4f6fa",
                      border: touchedFields.purchaseAmount && !isPurchaseAmountValid ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                      borderRadius: "12px",
                      fontSize: "14px",
                      color: isDark ? "var(--text-primary)" : "#101828",
                      outline: "none"
                    }}
                  />
                  {touchedFields.purchaseAmount && !isPurchaseAmountValid && (
                    <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                      Purchase Value must be greater than 0 and in currency format ({CURRENCY_PREFIX}).
                    </div>
                  )}
                </div>
              </div>

              {/* Purchase Date */}
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#1e293b", marginBottom: "8px" }}>
                  Purchase Date <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="date"
                  max={getTodayString()}
                  value={purchaseDate}
                  onChange={(e) => handleDateChange(e.target.value, setPurchaseDate)}
                  onPaste={(e) => handleDatePaste(e, setPurchaseDate)}
                  onBlur={(e) => {
                    handleDateBlur(e.target.value, setPurchaseDate);
                    markTouched("purchaseDate");
                  }}
                  style={{
                    width: "100%",
                    height: "48px",
                    padding: "0 16px",
                    background: isDark ? "var(--surface-2)" : "#f4f6fa",
                    border: touchedFields.purchaseDate && dateErrors.purchaseDate ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                    borderRadius: "12px",
                    fontSize: "14px",
                    color: isDark ? "var(--text-primary)" : "#101828",
                    outline: "none"
                  }}
                />
                {dateErrors.purchaseDate && (touchedFields.purchaseDate || purchaseDate) && (
                  <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                    {dateErrors.purchaseDate}
                  </div>
                )}
              </div>

              {/* Depreciation Schedule Radios */}
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#1e293b", marginBottom: "8px" }}>
                  Depreciation Schedule
                </label>
                <div style={{ display: "flex", gap: "24px", marginTop: "4px" }}>
                  <div
                    onClick={() => setHasDepreciationSchedule(true)}
                    style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: isDark ? "var(--text-primary)" : "#1e293b", cursor: "pointer", fontWeight: 500 }}
                  >
                    <div style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      border: hasDepreciationSchedule ? (isDark ? "2.5px solid var(--accent)" : "2.5px solid #1B265C") : (isDark ? "2px solid var(--text-muted)" : "2px solid #A0AEC0"),
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
                          background: isDark ? "var(--accent)" : "#1B265C"
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
                    style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: isDark ? "var(--text-primary)" : "#1e293b", cursor: "pointer", fontWeight: 500 }}
                  >
                    <div style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      border: !hasDepreciationSchedule ? (isDark ? "2.5px solid var(--accent)" : "2.5px solid #1B265C") : (isDark ? "2px solid var(--text-muted)" : "2px solid #A0AEC0"),
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
                          background: isDark ? "var(--accent)" : "#1B265C"
                        }} />
                      )}
                    </div>
                    No
                  </div>
                </div>

                {hasDepreciationSchedule && (
                  <div style={{ marginTop: "12px" }}>
                    {isUploadingDepreciationSchedule ? (
                      <div style={{ border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, borderRadius: "12px", padding: "12px", background: isDark ? "var(--surface-2)" : "#f8f9fc" }}>
                        <div style={{ fontSize: "12px", fontWeight: 500, color: isDark ? "var(--text-primary)" : "#344054" }}>Uploading depreciation document ({depreciationUploadProgress}%)</div>
                      </div>
                    ) : depreciationScheduleDocument ? (
                      <div style={{ border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, borderRadius: "12px", padding: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", background: isDark ? "var(--surface-2)" : "#f8f9fc" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: isDark ? "var(--text-primary)" : "#344054" }}>{depreciationScheduleDocument.filename}</span>
                        <button type="button" onClick={() => setDepreciationScheduleDocument(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#98a2b3" }}>✕</button>
                      </div>
                    ) : (
                      <div
                        onClick={() => document.getElementById("mobile-doc-input")?.click()}
                        style={{ border: `1.5px dashed ${isDark ? "var(--border)" : "#eaeef4"}`, background: isDark ? "var(--surface-2)" : "#f8f9fc", borderRadius: "12px", padding: "16px", textAlign: "center", cursor: "pointer" }}
                      >
                        <input
                          type="file"
                          id="mobile-doc-input"
                          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                          onChange={(e) => { const file = e.target.files?.[0]; if (file) handleDocUpload(file); }}
                          style={{ display: "none" }}
                        />
                        <span style={{ fontSize: "13px", color: isDark ? "var(--accent)" : "#2f3c82", fontWeight: 600 }}>+ Upload depreciation schedule</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Beneficiaries section */}
              {takesOwnershipDetails && (
                <div style={{ borderTop: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, paddingTop: "20px", marginTop: "10px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 800, color: isDark ? "var(--text-secondary)" : "#64748b", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "12px" }}>
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
                          onKeyDown={(e) => {
                            if (/[0-9]/.test(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          style={{
                            flex: 1,
                            height: "48px",
                            padding: "0 16px",
                            background: isDark ? "var(--surface-2)" : "#f4f6fa",
                            border: (b.name === "" && b.percentage !== "")
                              ? "1px solid #ef4444"
                              : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                            borderRadius: "12px",
                            fontSize: "14px",
                            color: isDark ? "var(--text-primary)" : "#101828",
                            outline: "none"
                          }}
                        />
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <input
                            type="number"
                            placeholder="0"
                            value={b.percentage}
                            onChange={(e) => handleSaveBeneficiary(idx, "percentage", e.target.value)}
                            onKeyDown={(e) => {
                              if (["-", "e", "E", "+"].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            style={{
                              width: "60px",
                              height: "48px",
                              padding: "0 12px",
                              background: isDark ? "var(--surface-2)" : "#f4f6fa",
                              border: ((b.percentage !== "" && (Number(b.percentage) <= 0 || isNaN(Number(b.percentage)))) || (b.percentage === "" && b.name !== ""))
                                ? "1px solid #ef4444"
                                : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                              borderRadius: "12px",
                              fontSize: "14px",
                              color: isDark ? "var(--text-primary)" : "#101828",
                              outline: "none",
                              textAlign: "center"
                            }}
                          />
                          <span style={{ fontSize: "14px", color: isDark ? "var(--text-secondary)" : "#667085", fontWeight: 700 }}>%</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteBeneficiaryRow(idx)}
                          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "20px", height: "20px" }}>
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Beneficiary validation errors */}
                  {beneficiaries.some(b => b.percentage !== "" && (Number(b.percentage) <= 0 || isNaN(Number(b.percentage)))) && (
                    <span style={{ fontSize: "12px", color: "#ef4444", display: "block", marginTop: "-4px", marginBottom: "12px" }}>
                      Beneficiary ownership percentage must be greater than 0%.
                    </span>
                  )}
                  {beneficiaries.some(b => (b.name === "" && b.percentage !== "") || (b.percentage === "" && b.name !== "")) && (
                    <span style={{ fontSize: "12px", color: "#ef4444", display: "block", marginTop: "-4px", marginBottom: "12px" }}>
                      Please provide both a name and a valid percentage.
                    </span>
                  )}
                  {totalOwnership > 100 && (
                    <span style={{ fontSize: "12px", color: "#ef4444", display: "block", marginTop: "-4px", marginBottom: "12px" }}>
                      Total ownership percentage cannot exceed 100%.
                    </span>
                  )}

                  {/* Add Beneficiary Button */}
                  <button
                    type="button"
                    onClick={addBeneficiaryRow}
                    style={{
                      width: "100%",
                      height: "48px",
                      background: isDark ? "var(--surface-2)" : "#ffffff",
                      border: `1px solid ${isDark ? "var(--accent)" : "#1B265C"}`,
                      borderRadius: "12px",
                      color: isDark ? "var(--accent)" : "#1B265C",
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
                    background: totalOwnership > 100 
                      ? (isDark ? "rgba(239, 68, 68, 0.12)" : "#fef2f2") 
                      : totalOwnership === 100 
                        ? (isDark ? "rgba(93, 202, 165, 0.12)" : "#f0fdf4") 
                        : (isDark ? "rgba(244, 161, 23, 0.08)" : "#fffdf0"),
                    border: `1px solid ${
                      totalOwnership > 100 
                        ? (isDark ? "rgba(239, 68, 68, 0.3)" : "#fecaca") 
                        : totalOwnership === 100 
                          ? (isDark ? "var(--border)" : "#bbf7d0") 
                          : (isDark ? "var(--border)" : "#fef08a")
                    }`,
                    borderRadius: "12px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: totalOwnership > 100 
                      ? (isDark ? "#ef4444" : "#b91c1c") 
                      : totalOwnership === 100 
                        ? (isDark ? "var(--success)" : "#15803d") 
                        : (isDark ? "var(--accent)" : "#b45309")
                  }}>
                    <span>Total Ownership:</span>
                    <span>{totalOwnership.toFixed(1)}%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ fontSize: "11px", fontWeight: 800, color: isDark ? "var(--text-secondary)" : "#64748b", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                LOAN DETAILS — OPTIONAL
              </div>

              {/* Does the property have a loan? checkbox */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "16px", background: isDark ? "var(--surface-1)" : "#f8fafc", border: `1px solid ${isDark ? "var(--border)" : "#e2e8f0"}`, borderRadius: "12px", marginBottom: "10px" }}>
                <input
                  type="checkbox"
                  id="has-loan-checkbox-mobile"
                  checked={hasLoan}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setHasLoan(checked);
                    if (!checked) {
                      setBankName("");
                      setBsbNumber("");
                      setLoanAccountNumber("");
                      setLoanAllocationPercentage("");
                      setLoanAmount("");
                      setTouchedFields((prev) => {
                        const updated = { ...prev };
                        delete updated.bankName;
                        delete updated.bsbNumber;
                        delete updated.loanAccountNumber;
                        delete updated.loanAllocationPercentage;
                        delete updated.loanAmount;
                        return updated;
                      });
                    }
                  }}
                  style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: isDark ? "var(--accent)" : "#1B265C" }}
                />
                <label htmlFor="has-loan-checkbox-mobile" style={{ fontSize: "14px", fontWeight: 600, color: isDark ? "var(--text-primary)" : "#1e293b", cursor: "pointer", userSelect: "none" }}>
                  Does the property have a loan?
                </label>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "20px", opacity: hasLoan ? 1 : 0.5, pointerEvents: hasLoan ? "auto" : "none", transition: "opacity 0.2s" }}>
                {/* Bank Name */}
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#1e293b", marginBottom: "8px" }}>
                    Bank Name {hasLoan && <em style={{ color: "#d92d20", fontStyle: "normal" }}>*</em>}
                  </label>
                  <input
                    type="text"
                    placeholder={hasLoan ? "eg., Wells Fargo" : "No loan details required"}
                    value={bankName}
                    disabled={!hasLoan}
                    onChange={(e) => setBankName(e.target.value.replace(/[^a-zA-Z\s]/g, ""))}
                    onBlur={() => markTouched("bankName")}
                    style={{
                      width: "100%",
                      height: "48px",
                      padding: "0 16px",
                      background: hasLoan ? (isDark ? "var(--surface-2)" : "#ffffff") : (isDark ? "var(--surface-1)" : "#f1f5f9"),
                      border: touchedFields.bankName && !isBankNameValid ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                      borderRadius: "12px",
                      fontSize: "14px",
                      color: hasLoan ? (isDark ? "var(--text-primary)" : "#101828") : (isDark ? "var(--text-muted)" : "#94a3b8"),
                      outline: "none",
                      cursor: hasLoan ? "text" : "not-allowed"
                    }}
                  />
                  {touchedFields.bankName && !isBankNameValid && (
                    <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                      {!bankName.trim() ? "Bank Name is required." : "Bank Name must contain letters and spaces only."}
                    </div>
                  )}
                </div>

                {/* BSB Number and Loan % Allocation */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#1e293b", marginBottom: "8px" }}>
                      BSB Number {hasLoan && <em style={{ color: "#d92d20", fontStyle: "normal" }}>*</em>}
                    </label>
                    <input
                      type="text"
                      placeholder={hasLoan ? "e.g., 123456" : "No loan"}
                      value={bsbNumber}
                      disabled={!hasLoan}
                      onChange={(e) => setBsbNumber(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      onBlur={() => markTouched("bsbNumber")}
                      style={{
                        width: "100%",
                        height: "48px",
                        padding: "0 16px",
                        background: hasLoan ? (isDark ? "var(--surface-2)" : "#ffffff") : (isDark ? "var(--surface-1)" : "#f1f5f9"),
                        border: touchedFields.bsbNumber && !isBsbValid ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                        borderRadius: "12px",
                        fontSize: "14px",
                        color: hasLoan ? (isDark ? "var(--text-primary)" : "#101828") : (isDark ? "var(--text-muted)" : "#94a3b8"),
                        outline: "none",
                        cursor: hasLoan ? "text" : "not-allowed"
                      }}
                    />
                    {touchedFields.bsbNumber && !isBsbValid && (
                      <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                        {!bsbNumber.trim() ? "BSB Number is required." : "BSB Number must be exactly 6 digits."}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#1e293b", marginBottom: "8px" }}>
                      Loan % Allocation {hasLoan && <em style={{ color: "#d92d20", fontStyle: "normal" }}>*</em>}
                    </label>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <input
                        type="number"
                        placeholder={hasLoan ? "0 %" : "No loan"}
                        disabled={!hasLoan}
                        onKeyDown={(e) => {
                          if (e.key === "0" && !loanAllocationPercentage) {
                            e.preventDefault();
                          }
                          if (e.key === "-" || e.key === "e" || e.key === "+") {
                            e.preventDefault();
                          }
                        }}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (val.startsWith("0")) {
                            if (!val.startsWith("0.")) {
                              val = val.replace(/^0+/, "");
                            }
                          }
                          if (Number(val) > 100) {
                            val = "100";
                          }
                          setLoanAllocationPercentage(val);
                        }}
                        onBlur={() => markTouched("loanAllocationPercentage")}
                        value={loanAllocationPercentage}
                        style={{
                          width: "100%",
                          height: "48px",
                          padding: "0 24px 0 12px",
                          background: hasLoan ? (isDark ? "var(--surface-2)" : "#ffffff") : (isDark ? "var(--surface-1)" : "#f1f5f9"),
                          border: touchedFields.loanAllocationPercentage && !isLoanAllocationValid ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                          borderRadius: "12px",
                          fontSize: "14px",
                          color: hasLoan ? (isDark ? "var(--text-primary)" : "#101828") : (isDark ? "var(--text-muted)" : "#94a3b8"),
                          outline: "none",
                          cursor: hasLoan ? "text" : "not-allowed"
                        }}
                      />
                      <span style={{ position: "absolute", right: "12px", fontSize: "14px", color: isDark ? "var(--text-secondary)" : "#667085", fontWeight: 500 }}>%</span>
                    </div>
                    {touchedFields.loanAllocationPercentage && !isLoanAllocationValid && (
                      <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                        {!loanAllocationPercentage
                          ? "Loan allocation is required."
                          : Number(loanAllocationPercentage) === 0
                            ? "Loan allocation percentage cannot be 0."
                            : "Loan Allocation percentage must be greater than 0% and at most 100%."}
                      </div>
                    )}
                  </div>
                </div>

                {/* Loan Account Number */}
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#1e293b", marginBottom: "8px" }}>
                    Loan Account Number {hasLoan && <em style={{ color: "#d92d20", fontStyle: "normal" }}>*</em>}
                  </label>
                  <input
                    type="text"
                    placeholder={hasLoan ? "Enter account number" : "No loan"}
                    value={loanAccountNumber}
                    disabled={!hasLoan}
                    onChange={(e) => setLoanAccountNumber(e.target.value.replace(/\D/g, ""))}
                    onBlur={() => markTouched("loanAccountNumber")}
                    style={{
                      width: "100%",
                      height: "48px",
                      padding: "0 16px",
                      background: hasLoan ? (isDark ? "var(--surface-2)" : "#ffffff") : (isDark ? "var(--surface-1)" : "#f1f5f9"),
                      border: touchedFields.loanAccountNumber && !isLoanAccountNumberValid ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                      borderRadius: "12px",
                      fontSize: "14px",
                      color: hasLoan ? (isDark ? "var(--text-primary)" : "#101828") : (isDark ? "var(--text-muted)" : "#94a3b8"),
                      outline: "none",
                      cursor: hasLoan ? "text" : "not-allowed"
                    }}
                  />
                  {touchedFields.loanAccountNumber && !isLoanAccountNumberValid && (
                    <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                      {!loanAccountNumber.trim() ? "Loan Account Number is required." : "Loan Account Number must contain numeric values only."}
                    </div>
                  )}
                </div>

                {/* Loan Amount */}
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#1e293b", marginBottom: "8px" }}>
                    Loan Amount {hasLoan && <em style={{ color: "#d92d20", fontStyle: "normal" }}>*</em>}
                  </label>
                  <input
                    type="text"
                    placeholder={hasLoan ? "Enter amount" : "No loan"}
                    value={loanAmount}
                    disabled={!hasLoan}
                    onChange={(e) => setLoanAmount(formatAUD(e.target.value))}
                    onBlur={() => markTouched("loanAmount")}
                    style={{
                      width: "100%",
                      height: "48px",
                      padding: "0 16px",
                      background: hasLoan ? (isDark ? "var(--surface-2)" : "#ffffff") : (isDark ? "var(--surface-1)" : "#f1f5f9"),
                      border: touchedFields.loanAmount && !isLoanAmountValid ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                      borderRadius: "12px",
                      fontSize: "14px",
                      color: hasLoan ? (isDark ? "var(--text-primary)" : "#101828") : (isDark ? "var(--text-muted)" : "#94a3b8"),
                      outline: "none",
                      cursor: hasLoan ? "text" : "not-allowed"
                    }}
                  />
                  {touchedFields.loanAmount && !isLoanAmountValid && (
                    <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                      {!loanAmount.trim() 
                        ? "Loan Amount is required." 
                        : (Number.parseFloat(loanAmount.replace(/[^0-9.-]/g, "")) <= 0 || isNaN(Number.parseFloat(loanAmount.replace(/[^0-9.-]/g, ""))))
                          ? "Loan Amount must be greater than 0." 
                          : `Loan Amount must accept only currency format (${CURRENCY_PREFIX}).`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Mobile Error Message */}
          {errorMessage && (
            <div style={{ marginTop: "16px", padding: "12px 16px", background: isDark ? "rgba(240, 149, 149, 0.12)" : "#fef2f2", border: `1px solid ${isDark ? "var(--border)" : "#fca5a5"}`, borderRadius: "8px", color: isDark ? "var(--danger)" : "#991b1b", fontSize: "13px", fontWeight: 500 }}>
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
          background: isDark ? "var(--surface-1)" : "#ffffff",
          borderTop: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
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
              background: isCurrentStepValid ? (isDark ? "var(--accent)" : "#1B265C") : (isDark ? "var(--surface-2)" : "#A2AABF"),
              border: "none",
              color: isCurrentStepValid ? (isDark ? "#0f1330" : "#ffffff") : (isDark ? "var(--text-muted)" : "#ffffff"),
              fontSize: "16px",
              fontWeight: 700,
              cursor: isCurrentStepValid ? "pointer" : "not-allowed",
              transition: "all 0.2s"
            }}
          >
            {step === 3 ? (isSaving ? "Saving..." : (mode === "edit" ? "Save Changes" : "Save and Add Property")) : "Continue"}
          </button>
        </div>

        {/* Success Modal */}
        {saved && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: isDark ? "rgba(0, 0, 0, 0.6)" : "rgba(16, 24, 40, 0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: isDark ? "var(--surface-1)" : "#ffffff", borderRadius: "24px", padding: "36px 24px", width: "90%", maxWidth: "340px", textAlign: "center", boxShadow: "0px 20px 48px rgba(16, 24, 40, 0.12)", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}` }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: isDark ? "rgba(93, 202, 165, 0.12)" : "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px auto" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke={isDark ? "var(--success)" : "#10b981"} strokeWidth="3" style={{ width: "32px", height: "32px" }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: 800, color: isDark ? "var(--text-primary)" : "#101828", margin: "0 0 8px 0" }}>
                {mode === "edit" ? "Property Updated" : "Property Added"}
              </h3>
              <p style={{ fontSize: "13px", color: isDark ? "var(--text-secondary)" : "#667085", margin: "0 0 24px 0", lineHeight: "1.4" }}>
                <strong>{propertyName}</strong> has been {mode === "edit" ? "updated" : "added"} successfully.
              </p>
              <Link
                href={onSuccessUrl}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "44px",
                  width: "100%",
                  background: isDark ? "var(--accent)" : "#1B265C",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: isDark ? "#0f1330" : "#ffffff",
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
      <div 
        onKeyDown={handleKeyDown}
        style={{ background: isDark ? "var(--surface-0)" : "#f7f9fc", color: isDark ? "var(--text-primary)" : "inherit", minHeight: "100vh", padding: "40px", fontFamily: '"Inter", sans-serif' }}
      >
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: isDark ? "var(--text-secondary)" : "#667085", fontWeight: 500, marginBottom: "8px" }}>
            <Link href={backUrl} style={{ color: isDark ? "var(--accent)" : "#2f3c82", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "14px", height: "14px" }}>
                <path d="M15 19l-7-7 7-7" />
              </svg>
              {backText}
            </Link>
            <span>/</span>
            <span style={{ color: isDark ? "var(--text-secondary)" : "#344054" }}>{mode === "edit" ? "Edit property" : "Add property"}</span>
          </div>
          <h1 style={{ fontSize: "32px", fontWeight: 800, color: isDark ? "var(--text-primary)" : "#101828", margin: "0 0 4px 0", letterSpacing: "-0.02em" }}>
            {mode === "edit" ? "Edit property" : "Add a new property"}
          </h1>
          <p style={{ fontSize: "15px", color: isDark ? "var(--text-secondary)" : "#667085", margin: 0, fontWeight: 400 }}>
            {mode === "edit" ? "Modify the property details, financial info, and supporting documents" : "Enter the property details, financial info, and link any supporting documents"}
          </p>
        </div>

        <div style={{ width: "100%" }}>
          {step === 1 && (
            <div style={{ background: isDark ? "var(--surface-1)" : "#ffffff", borderRadius: "16px", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, padding: "32px", boxShadow: isDark ? "none" : "0px 8px 30px rgba(16, 24, 40, 0.02)" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#667085", letterSpacing: "0.08em", marginBottom: "20px", textTransform: "uppercase" }}>
                STEP 1 — PROPERTY DETAILS
              </div>

              {/* Property Image Dropzone */}
              <div style={{ marginBottom: "28px" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: isDark ? "var(--text-secondary)" : "#344054", marginBottom: "8px" }}>
                  Property image
                </label>

                {isUploadingPropertyImage ? (
                  <div style={{ border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, borderRadius: "12px", padding: "20px", display: "flex", alignItems: "center", gap: "16px", background: isDark ? "var(--surface-2)" : "#f8f9fc" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: isDark ? "var(--surface-1)" : "#eaeef4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke={isDark ? "var(--accent)" : "#2f3c82"} strokeWidth="2" style={{ width: "20px", height: "20px" }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: 500, color: isDark ? "var(--text-primary)" : "#344054", marginBottom: "4px" }}>
                        <span>Uploading property image...</span>
                        <span>{propertyImageProgress}%</span>
                      </div>
                      <div style={{ height: "6px", width: "100%", background: isDark ? "var(--surface-1)" : "#eaeef4", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${propertyImageProgress}%`, background: isDark ? "var(--accent)" : "#2f3c82", transition: "width 0.1s ease" }} />
                      </div>
                    </div>
                  </div>
                ) : imageUrl ? (
                  <div style={{ border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, borderRadius: "12px", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: isDark ? "var(--surface-2)" : "#f8f9fc" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <img
                        src={imageUrl.startsWith("http") || imageUrl.startsWith("/") ? imageUrl : `/api/documents/download?key=${encodeURIComponent(imageUrl)}`}
                        alt="Preview"
                        style={{ width: "48px", height: "48px", borderRadius: "8px", objectFit: "cover", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}` }}
                      />
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: isDark ? "var(--text-primary)" : "#344054" }}>{propertyImageName || "Property Image"}</div>
                        <div style={{ fontSize: "12px", color: isDark ? "var(--success)" : "#10b981", fontWeight: 500 }}>Successfully uploaded</div>
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
                      border: `2px dashed ${isDraggingImage ? (isDark ? "var(--accent)" : "#2f3c82") : (isDark ? "var(--border)" : "#eaeef4")}`,
                      background: isDraggingImage ? (isDark ? "var(--surface-1)" : "#f4f6fc") : (isDark ? "var(--surface-2)" : "#f8f9fc"),
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
                    <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: isDark ? "var(--surface-1)" : "#ffffff", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px auto", boxShadow: isDark ? "none" : "0px 2px 8px rgba(16, 24, 40, 0.02)" }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke={isDark ? "var(--text-secondary)" : "#667085"} strokeWidth="2" style={{ width: "20px", height: "20px" }}>
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: isDark ? "var(--text-primary)" : "#101828", marginBottom: "4px" }}>
                      Tap to add property photo
                    </div>
                    <div style={{ fontSize: "12px", color: isDark ? "var(--text-secondary)" : "#667085", fontWeight: 400 }}>
                      JPEG, PNG max 10 MB<br />Camera or Gallery
                    </div>
                  </div>
                )}
              </div>

              {/* Entity Name & Property Name Fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: isDark ? "var(--text-secondary)" : "#344054", marginBottom: "8px" }}>
                    Entity name <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <div ref={entityDropdownRef} style={{ position: "relative" }}>
                    <button
                      type="button"
                      disabled={mode === "edit" || !!entityId}
                      onClick={() => mode !== "edit" && !entityId && setIsEntityOpen(!isEntityOpen)}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 16px",
                        background: (mode === "edit" || !!entityId)
                          ? (isDark ? "var(--surface-1)" : "#f1f5f9")
                          : (isDark ? "var(--surface-2)" : "#ffffff"),
                        border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                        borderRadius: "8px",
                        fontSize: "14px",
                        color: selectedEntityId ? (isDark ? "var(--text-primary)" : "#101828") : (isDark ? "var(--text-muted)" : "#98a2b3"),
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: (mode === "edit" || !!entityId) ? "not-allowed" : "pointer",
                        fontWeight: 500,
                        opacity: (mode === "edit" || !!entityId) ? 0.7 : 1
                      }}
                    >
                      <span>{selectedEntity ? selectedEntity.name : "Select Entity"}</span>
                      {mode !== "edit" && !entityId && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="#667085" strokeWidth="2" style={{ width: "16px", height: "16px", transform: isEntityOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      )}
                    </button>
                    {isEntityOpen && mode !== "edit" && !entityId && (
                      <div style={{ position: "absolute", top: "48px", left: 0, right: 0, background: isDark ? "var(--surface-1)" : "#ffffff", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, borderRadius: "8px", boxShadow: isDark ? "none" : "0px 8px 30px rgba(16, 24, 40, 0.08)", zIndex: 30, maxHeight: "200px", overflowY: "auto" }}>
                        {entities.map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => { setSelectedEntityId(e.id); setIsEntityOpen(false); }}
                            style={{
                              width: "100%",
                              padding: "12px 16px",
                              textAlign: "left",
                              background: selectedEntityId === e.id ? (isDark ? "var(--surface-2)" : "#f4f6fc") : "transparent",
                              border: "none",
                              fontSize: "14px",
                              color: isDark ? "var(--text-primary)" : "#101828",
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
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: isDark ? "var(--text-secondary)" : "#344054", marginBottom: "8px" }}>
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
                      background: isDark ? "var(--surface-2)" : "#ffffff",
                      border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                      borderRadius: "8px",
                      fontSize: "14px",
                      color: isDark ? "var(--text-primary)" : "#101828",
                      outline: "none"
                    }}
                  />
                </div>
              </div>

              {/* Property Location Field */}
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: isDark ? "var(--text-secondary)" : "#344054", marginBottom: "8px" }}>
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
                    background: isDark ? "var(--surface-2)" : "#ffffff",
                    border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                    borderRadius: "8px",
                    fontSize: "14px",
                    color: isDark ? "var(--text-primary)" : "#101828",
                    outline: "none"
                  }}
                />
              </div>

              {/* Property Type & Status Dropdowns */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: isDark ? "var(--text-secondary)" : "#344054", marginBottom: "8px" }}>
                    Property type <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <div ref={typeDropdownRef} style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => setIsTypeOpen(!isTypeOpen)}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 16px",
                        background: isDark ? "var(--surface-2)" : "#ffffff",
                        border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                        borderRadius: "8px",
                        fontSize: "14px",
                        color: propertyType ? (isDark ? "var(--text-primary)" : "#101828") : (isDark ? "var(--text-muted)" : "#98a2b3"),
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
                      <div style={{ position: "absolute", top: "48px", left: 0, right: 0, background: isDark ? "var(--surface-1)" : "#ffffff", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, borderRadius: "8px", boxShadow: isDark ? "none" : "0px 8px 30px rgba(16, 24, 40, 0.08)", zIndex: 30 }}>
                        {propertyTypeOptions.map((o) => (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => { setPropertyType(o.value); setIsTypeOpen(false); }}
                            style={{
                              width: "100%",
                              padding: "12px 16px",
                              textAlign: "left",
                              background: propertyType === o.value ? (isDark ? "var(--surface-2)" : "#f4f6fc") : "transparent",
                              border: "none",
                              fontSize: "14px",
                              color: isDark ? "var(--text-primary)" : "#101828",
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
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: isDark ? "var(--text-secondary)" : "#344054", marginBottom: "8px" }}>
                    Property status <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <div ref={statusDropdownRef} style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => setIsStatusOpen(!isStatusOpen)}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 16px",
                        background: isDark ? "var(--surface-2)" : "#ffffff",
                        border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                        borderRadius: "8px",
                        fontSize: "14px",
                        color: status ? (isDark ? "var(--text-primary)" : "#101828") : (isDark ? "var(--text-muted)" : "#98a2b3"),
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
                      <div style={{ position: "absolute", top: "48px", left: 0, right: 0, background: isDark ? "var(--surface-1)" : "#ffffff", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, borderRadius: "8px", boxShadow: isDark ? "none" : "0px 8px 30px rgba(16, 24, 40, 0.08)", zIndex: 30, maxHeight: "200px", overflowY: "auto" }}>
                        {propertyStatusOptions.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => { setStatus(opt); setIsStatusOpen(false); }}
                            style={{
                              width: "100%",
                              padding: "12px 16px",
                              textAlign: "left",
                              background: status === opt ? (isDark ? "var(--surface-2)" : "#f4f6fc") : "transparent",
                              border: "none",
                              fontSize: "14px",
                              color: isDark ? "var(--text-primary)" : "#101828",
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px", padding: "16px", background: isDark ? "var(--surface-2)" : "#f8f9fc", borderRadius: "8px", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}` }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: isDark ? "var(--text-secondary)" : "#344054", marginBottom: "6px" }}>
                      Available for Rent Date <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <input
                      type="date"
                      max="9999-12-31"
                      value={availableForRentDate}
                      onChange={(e) => handleDateChange(e.target.value, setAvailableForRentDate)}
                      onPaste={(e) => handleDatePaste(e, setAvailableForRentDate)}
                      onBlur={(e) => {
                        handleDateBlur(e.target.value, setAvailableForRentDate);
                        markTouched("availableForRentDate");
                      }}
                      style={{
                        width: "100%",
                        height: "40px",
                        padding: "0 12px",
                        background: isDark ? "var(--surface-1)" : "#ffffff",
                        border: touchedFields.availableForRentDate && dateErrors.availableForRentDate ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                        borderRadius: "6px",
                        fontSize: "13px",
                        color: isDark ? "var(--text-primary)" : "#101828"
                      }}
                    />
                    {dateErrors.availableForRentDate && (touchedFields.availableForRentDate || availableForRentDate) && (
                      <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                        {dateErrors.availableForRentDate}
                      </div>
                    )}
                  </div>
                  {status === "Rented" && (
                    <div>
                      <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: isDark ? "var(--text-secondary)" : "#344054", marginBottom: "6px" }}>
                        First Rental Income Date <span style={{ color: "#EF4444" }}>*</span>
                      </label>
                      <input
                        type="date"
                        max="9999-12-31"
                        value={firstRentalIncomeDate}
                        onChange={(e) => handleDateChange(e.target.value, setFirstRentalIncomeDate)}
                        onPaste={(e) => handleDatePaste(e, setFirstRentalIncomeDate)}
                        onBlur={(e) => {
                          handleDateBlur(e.target.value, setFirstRentalIncomeDate);
                          markTouched("firstRentalIncomeDate");
                        }}
                        style={{
                          width: "100%",
                          height: "40px",
                          padding: "0 12px",
                          background: isDark ? "var(--surface-1)" : "#ffffff",
                          border: touchedFields.firstRentalIncomeDate && dateErrors.firstRentalIncomeDate ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                          borderRadius: "6px",
                          fontSize: "13px",
                          color: isDark ? "var(--text-primary)" : "#101828"
                        }}
                      />
                      {dateErrors.firstRentalIncomeDate && (touchedFields.firstRentalIncomeDate || firstRentalIncomeDate) && (
                        <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                          {dateErrors.firstRentalIncomeDate}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {status === "Under Renovation" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px", padding: "16px", background: isDark ? "var(--surface-2)" : "#f8f9fc", borderRadius: "8px", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}` }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: isDark ? "var(--text-secondary)" : "#344054", marginBottom: "6px" }}>
                      Renovation Start Date <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <input
                      type="date"
                      max="9999-12-31"
                      value={renovationStartDate}
                      onChange={(e) => handleDateChange(e.target.value, setRenovationStartDate)}
                      onPaste={(e) => handleDatePaste(e, setRenovationStartDate)}
                      onBlur={(e) => {
                        handleDateBlur(e.target.value, setRenovationStartDate);
                        markTouched("renovationStartDate");
                      }}
                      style={{
                        width: "100%",
                        height: "40px",
                        padding: "0 12px",
                        background: isDark ? "var(--surface-1)" : "#ffffff",
                        border: touchedFields.renovationStartDate && dateErrors.renovationStartDate ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                        borderRadius: "6px",
                        fontSize: "13px",
                        color: isDark ? "var(--text-primary)" : "#101828"
                      }}
                    />
                    {dateErrors.renovationStartDate && (touchedFields.renovationStartDate || renovationStartDate) && (
                      <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                        {dateErrors.renovationStartDate}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: isDark ? "var(--text-secondary)" : "#344054", marginBottom: "6px" }}>
                      Renovation End Date <small style={{ color: isDark ? "var(--text-muted)" : "#667085" }}>(Optional)</small>
                    </label>
                    <input
                      type="date"
                      max="9999-12-31"
                      value={renovationEndDate}
                      onChange={(e) => handleDateChange(e.target.value, setRenovationEndDate)}
                      onPaste={(e) => handleDatePaste(e, setRenovationEndDate)}
                      onBlur={(e) => {
                        handleDateBlur(e.target.value, setRenovationEndDate);
                        markTouched("renovationEndDate");
                      }}
                      style={{
                        width: "100%",
                        height: "40px",
                        padding: "0 12px",
                        background: isDark ? "var(--surface-1)" : "#ffffff",
                        border: touchedFields.renovationEndDate && dateErrors.renovationEndDate ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                        borderRadius: "6px",
                        fontSize: "13px",
                        color: isDark ? "var(--text-primary)" : "#101828"
                      }}
                    />
                    {dateErrors.renovationEndDate && (touchedFields.renovationEndDate || renovationEndDate) && (
                      <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                        {dateErrors.renovationEndDate}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 1 Footer */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "32px", borderTop: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, paddingTop: "24px" }}>
                <Link
                  href={backUrl}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "44px",
                    padding: "0 20px",
                    background: isDark ? "var(--surface-2)" : "#ffffff",
                    border: `1px solid ${isDark ? "var(--border)" : "#d0d5dd"}`,
                    borderRadius: "8px",
                    fontSize: "15px",
                    fontWeight: 600,
                    color: isDark ? "var(--text-primary)" : "#344054",
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
                    background: isStep1Valid ? (isDark ? "var(--accent)" : "#1a235a") : (isDark ? "var(--surface-2)" : "#cbd5e1"),
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "15px",
                    fontWeight: 600,
                    color: isStep1Valid ? (isDark ? "#0f1330" : "#ffffff") : (isDark ? "var(--text-muted)" : "#ffffff"),
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
              <div style={{ background: isDark ? "var(--surface-1)" : "#ffffff", borderRadius: "16px", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, padding: "32px", boxShadow: isDark ? "none" : "0px 8px 30px rgba(16, 24, 40, 0.02)" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#667085", letterSpacing: "0.08em", marginBottom: "20px", textTransform: "uppercase" }}>
                  STEP 2 — FINANCIAL INFO
                </div>

                {/* Financial values row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", marginBottom: "24px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: isDark ? "var(--text-secondary)" : "#344054", marginBottom: "8px" }}>
                      Market value <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder={`${CURRENCY_SYMBOL}0`}
                      value={estimatedMarketValue}
                      onChange={(e) => handleEstimatedMarketValueChange(e.target.value)}
                      onBlur={() => markTouched("estimatedMarketValue")}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 16px",
                        background: isDark ? "var(--surface-2)" : "#ffffff",
                        border: touchedFields.estimatedMarketValue && !isEstimatedMarketValueValid ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                        borderRadius: "8px",
                        fontSize: "14px",
                        color: isDark ? "var(--text-primary)" : "#101828",
                        outline: "none"
                      }}
                    />
                    {touchedFields.estimatedMarketValue && !isEstimatedMarketValueValid && (
                      <span style={{ fontSize: "12px", color: "#EF4444", marginTop: "4px", display: "block" }}>
                        Market Value must be greater than 0 and in currency format ({CURRENCY_PREFIX}).
                      </span>
                    )}
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: isDark ? "var(--text-secondary)" : "#344054", marginBottom: "8px" }}>
                      Purchase value <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder={`${CURRENCY_SYMBOL}0`}
                      value={purchaseAmount}
                      onChange={(e) => handlePurchaseAmountChange(e.target.value)}
                      onBlur={() => markTouched("purchaseAmount")}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 16px",
                        background: isDark ? "var(--surface-2)" : "#ffffff",
                        border: touchedFields.purchaseAmount && !isPurchaseAmountValid ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                        borderRadius: "8px",
                        fontSize: "14px",
                        color: isDark ? "var(--text-primary)" : "#101828",
                        outline: "none"
                      }}
                    />
                    {touchedFields.purchaseAmount && !isPurchaseAmountValid && (
                      <span style={{ fontSize: "12px", color: "#EF4444", marginTop: "4px", display: "block" }}>
                        Purchase Value must be greater than 0 and in currency format ({CURRENCY_PREFIX}).
                      </span>
                    )}
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: isDark ? "var(--text-secondary)" : "#344054", marginBottom: "8px" }}>
                      Purchase date <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <input
                      type="date"
                      max={getTodayString()}
                      value={purchaseDate}
                      onChange={(e) => handleDateChange(e.target.value, setPurchaseDate)}
                      onPaste={(e) => handleDatePaste(e, setPurchaseDate)}
                      onBlur={(e) => {
                        handleDateBlur(e.target.value, setPurchaseDate);
                        markTouched("purchaseDate");
                      }}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 16px",
                        background: isDark ? "var(--surface-2)" : "#ffffff",
                        border: touchedFields.purchaseDate && dateErrors.purchaseDate ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                        borderRadius: "8px",
                        fontSize: "14px",
                        color: isDark ? "var(--text-primary)" : "#101828",
                        outline: "none"
                      }}
                    />
                    {dateErrors.purchaseDate && (touchedFields.purchaseDate || purchaseDate) && (
                      <span style={{ fontSize: "12px", color: "#EF4444", marginTop: "4px", display: "block" }}>
                        {dateErrors.purchaseDate}
                      </span>
                    )}
                  </div>
                </div>

                {/* Depreciation schedule */}
                <div style={{ marginBottom: "28px" }}>
                  <span style={{ display: "block", fontSize: "14px", fontWeight: 600, color: isDark ? "var(--text-secondary)" : "#344054", marginBottom: "10px" }}>
                    Depreciation schedule
                  </span>
                  <div style={{ display: "flex", gap: "24px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: isDark ? "var(--text-primary)" : "#344054", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="depreciation"
                        checked={hasDepreciationSchedule}
                        onChange={() => setHasDepreciationSchedule(true)}
                        style={{ width: "16px", height: "16px", accentColor: isDark ? "var(--accent)" : "#1a235a" }}
                      />
                      Yes
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: isDark ? "var(--text-primary)" : "#344054", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="depreciation"
                        checked={!hasDepreciationSchedule}
                        onChange={() => {
                          setHasDepreciationSchedule(false);
                          setDepreciationScheduleDocument(null);
                          setDepreciationUploadProgress(0);
                        }}
                        style={{ width: "16px", height: "16px", accentColor: isDark ? "var(--accent)" : "#1a235a" }}
                      />
                      No
                    </label>
                  </div>

                  {hasDepreciationSchedule && (
                    <div style={{ marginTop: "16px" }}>
                      {isUploadingDepreciationSchedule ? (
                        <div style={{ border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, borderRadius: "12px", padding: "20px", display: "flex", alignItems: "center", gap: "16px", background: isDark ? "var(--surface-2)" : "#f8f9fc" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: 500, color: isDark ? "var(--text-primary)" : "#344054", marginBottom: "4px" }}>
                              <span>Uploading...</span>
                              <span>{depreciationUploadProgress}%</span>
                            </div>
                            <div style={{ height: "6px", width: "100%", background: isDark ? "var(--surface-1)" : "#eaeef4", borderRadius: "3px", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${depreciationUploadProgress}%`, background: isDark ? "var(--accent)" : "#2f3c82" }} />
                            </div>
                          </div>
                        </div>
                      ) : depreciationScheduleDocument ? (
                        <div style={{ border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: isDark ? "var(--surface-2)" : "#f8f9fc", padding: "16px" }}>
                          <span style={{ fontSize: "14px", fontWeight: 600, color: isDark ? "var(--text-primary)" : "#344054" }}>{depreciationScheduleDocument.filename}</span>
                          <button type="button" onClick={() => setDepreciationScheduleDocument(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#98a2b3" }}>✕</button>
                        </div>
                      ) : (
                        <div
                          onClick={() => document.getElementById("doc-upload-input")?.click()}
                          style={{ border: `2px dashed ${isDark ? "var(--border)" : "#eaeef4"}`, background: isDark ? "var(--surface-2)" : "#f8f9fc", borderRadius: "12px", padding: "24px 20px", textAlign: "center", cursor: "pointer" }}
                        >
                          <input type="file" id="doc-upload-input" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleDocUpload(file); }} style={{ display: "none" }} />
                          <span style={{ fontSize: "13px", color: isDark ? "var(--accent)" : "#2f3c82", fontWeight: 600 }}>Click to upload depreciation schedule</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Beneficiaries */}
                {takesOwnershipDetails && (
                  <div style={{ borderTop: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, paddingTop: "24px", marginTop: "24px" }}>
                    <span style={{ display: "block", fontSize: "12px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#475569", letterSpacing: "0.08em", marginBottom: "16px" }}>
                      BENEFICIARIES
                    </span>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 48px", gap: "16px", marginBottom: "8px", padding: "0 8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: isDark ? "var(--text-muted)" : "#94a3b8", textTransform: "uppercase" }}>BENEFICIARY NAME</span>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: isDark ? "var(--text-muted)" : "#94a3b8", textTransform: "uppercase" }}>OWNERSHIP %</span>
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
                            onKeyDown={(e) => {
                              if (/[0-9]/.test(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            style={{
                              width: "100%",
                              height: "44px",
                              padding: "0 16px",
                              border: (b.name === "" && b.percentage !== "")
                                ? "1px solid #ef4444"
                                : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                              borderRadius: "8px",
                              fontSize: "14px",
                              color: isDark ? "var(--text-primary)" : "#101828",
                              outline: "none",
                              background: isDark ? "var(--surface-2)" : "#ffffff"
                            }}
                          />
                          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                            <input
                              type="number"
                              placeholder="0"
                              value={b.percentage}
                              onChange={(e) => handleSaveBeneficiary(idx, "percentage", e.target.value)}
                              onKeyDown={(e) => {
                                if (["-", "e", "E", "+"].includes(e.key)) {
                                  e.preventDefault();
                                }
                              }}
                              style={{
                                width: "100%",
                                height: "44px",
                                padding: "0 32px 0 16px",
                                border: ((b.percentage !== "" && (Number(b.percentage) <= 0 || isNaN(Number(b.percentage)))) || (b.percentage === "" && b.name !== ""))
                                  ? "1px solid #ef4444"
                                  : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                                borderRadius: "8px",
                                fontSize: "14px",
                                color: isDark ? "var(--text-primary)" : "#101828",
                                outline: "none",
                                textAlign: "right",
                                background: isDark ? "var(--surface-2)" : "#ffffff"
                              }}
                            />
                            <span style={{ position: "absolute", right: "16px", fontSize: "14px", color: isDark ? "var(--text-secondary)" : "#667085" }}>%</span>
                          </div>
                          <button type="button" onClick={() => deleteBeneficiaryRow(idx)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "44px" }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "20px", height: "20px" }}>
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Beneficiary errors */}
                    {beneficiaries.some(b => b.percentage !== "" && (Number(b.percentage) <= 0 || isNaN(Number(b.percentage)))) && (
                      <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "-4px", marginBottom: "12px" }}>
                        Beneficiary ownership percentage must be greater than 0%.
                      </div>
                    )}
                    {beneficiaries.some(b => (b.name === "" && b.percentage !== "") || (b.percentage === "" && b.name !== "")) && (
                      <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "-4px", marginBottom: "12px" }}>
                        Please provide both a name and a valid percentage.
                      </div>
                    )}
                    {totalOwnership > 100 && (
                      <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "-4px", marginBottom: "12px" }}>
                        Total ownership percentage cannot exceed 100%.
                      </div>
                    )}

                    <button type="button" onClick={addBeneficiaryRow} style={{ background: "transparent", border: "none", fontSize: "14px", fontWeight: 600, color: isDark ? "var(--accent)" : "#2f3c82", cursor: "pointer", padding: "8px 0", marginBottom: "20px" }}>
                      + Add beneficiary
                    </button>

                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "16px 20px",
                      background: totalOwnership > 100 
                        ? (isDark ? "rgba(239, 68, 68, 0.12)" : "#fef2f2") 
                        : totalOwnership === 100 
                          ? (isDark ? "rgba(93, 202, 165, 0.12)" : "#f0fdf4") 
                          : (isDark ? "rgba(244, 161, 23, 0.12)" : "#fffbeb"),
                      border: `1px solid ${
                        totalOwnership > 100 
                          ? (isDark ? "rgba(239, 68, 68, 0.3)" : "#fecaca") 
                          : totalOwnership === 100 
                            ? (isDark ? "var(--border)" : "#bbf7d0") 
                            : (isDark ? "var(--border)" : "#fef3c7")
                      }`,
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: totalOwnership > 100 
                        ? (isDark ? "#ef4444" : "#b91c1c") 
                        : totalOwnership === 100 
                          ? (isDark ? "var(--success)" : "#15803d") 
                          : (isDark ? "var(--accent)" : "#b45309")
                    }}>
                      <span>Total ownership</span>
                      <span>{totalOwnership.toFixed(1)}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3 Card (Loan details) */}
              <div style={{ background: isDark ? "var(--surface-1)" : "#ffffff", borderRadius: "16px", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, padding: "32px", boxShadow: isDark ? "none" : "0px 8px 30px rgba(16, 24, 40, 0.02)" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: isDark ? "var(--text-secondary)" : "#667085", letterSpacing: "0.08em", marginBottom: "20px", textTransform: "uppercase" }}>
                  STEP 3 — LOAN DETAILS (OPTIONAL)
                </div>

                {/* Does the property have a loan? checkbox */}
                <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px", padding: "16px", background: isDark ? "var(--surface-2)" : "#f8fafc", border: `1px solid ${isDark ? "var(--border)" : "#e2e8f0"}`, borderRadius: "12px" }}>
                  <input
                    type="checkbox"
                    id="has-loan-checkbox-desktop"
                    checked={hasLoan}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setHasLoan(checked);
                      if (!checked) {
                        setBankName("");
                        setBsbNumber("");
                        setLoanAccountNumber("");
                        setLoanAllocationPercentage("");
                        setLoanAmount("");
                        setTouchedFields((prev) => {
                          const updated = { ...prev };
                          delete updated.bankName;
                          delete updated.bsbNumber;
                          delete updated.loanAccountNumber;
                          delete updated.loanAllocationPercentage;
                          delete updated.loanAmount;
                          return updated;
                        });
                      }
                    }}
                    style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: isDark ? "var(--accent)" : "#1B265C" }}
                  />
                  <label htmlFor="has-loan-checkbox-desktop" style={{ fontSize: "14px", fontWeight: 600, color: isDark ? "var(--text-primary)" : "#1e293b", cursor: "pointer", userSelect: "none" }}>
                    Does the property have a loan?
                  </label>
                </div>

                <div style={{ opacity: hasLoan ? 1 : 0.5, pointerEvents: hasLoan ? "auto" : "none", transition: "opacity 0.2s" }}>
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: isDark ? "var(--text-secondary)" : "#344054", marginBottom: "8px" }}>
                      Bank name {hasLoan && <em style={{ color: "#d92d20", fontStyle: "normal" }}>*</em>}
                    </label>
                    <input
                      type="text"
                      placeholder={hasLoan ? "e.g. Wells Fargo" : "No loan details required"}
                      value={bankName}
                      disabled={!hasLoan}
                      onChange={(e) => setBankName(e.target.value.replace(/[^a-zA-Z\s]/g, ""))}
                      onBlur={() => markTouched("bankName")}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 16px",
                        background: hasLoan ? (isDark ? "var(--surface-2)" : "#ffffff") : (isDark ? "var(--surface-1)" : "#f1f5f9"),
                        border: touchedFields.bankName && !isBankNameValid ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                        borderRadius: "8px",
                        fontSize: "14px",
                        color: hasLoan ? (isDark ? "var(--text-primary)" : "#101828") : (isDark ? "var(--text-muted)" : "#94a3b8"),
                        outline: "none",
                        cursor: hasLoan ? "text" : "not-allowed"
                      }}
                    />
                    {touchedFields.bankName && !isBankNameValid && (
                      <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                        {!bankName.trim() ? "Bank Name is required." : "Bank Name must contain letters and spaces only."}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: isDark ? "var(--text-secondary)" : "#344054", marginBottom: "8px" }}>
                        BSB number {hasLoan && <em style={{ color: "#d92d20", fontStyle: "normal" }}>*</em>}
                      </label>
                      <input
                        type="text"
                        placeholder={hasLoan ? "e.g. 123-456" : "No loan"}
                        value={bsbNumber}
                        disabled={!hasLoan}
                        onChange={(e) => setBsbNumber(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        onBlur={() => markTouched("bsbNumber")}
                        style={{
                          width: "100%",
                          height: "44px",
                          padding: "0 16px",
                          background: hasLoan ? (isDark ? "var(--surface-2)" : "#ffffff") : (isDark ? "var(--surface-1)" : "#f1f5f9"),
                          border: touchedFields.bsbNumber && !isBsbValid ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                          borderRadius: "8px",
                          fontSize: "14px",
                          color: hasLoan ? (isDark ? "var(--text-primary)" : "#101828") : (isDark ? "var(--text-muted)" : "#94a3b8"),
                          outline: "none",
                          cursor: hasLoan ? "text" : "not-allowed"
                        }}
                      />
                      {touchedFields.bsbNumber && !isBsbValid && (
                        <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                          {!bsbNumber.trim() ? "BSB Number is required." : "BSB Number must be exactly 6 digits."}
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: isDark ? "var(--text-secondary)" : "#344054", marginBottom: "8px" }}>
                        Loan % allocation {hasLoan && <em style={{ color: "#d92d20", fontStyle: "normal" }}>*</em>}
                      </label>
                      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        <input
                          type="number"
                          placeholder={hasLoan ? "0 %" : "No loan"}
                          disabled={!hasLoan}
                          onKeyDown={(e) => {
                            if (e.key === "0" && !loanAllocationPercentage) {
                              e.preventDefault();
                            }
                            if (e.key === "-" || e.key === "e" || e.key === "+") {
                              e.preventDefault();
                            }
                          }}
                          onChange={(e) => {
                            let val = e.target.value;
                            if (val.startsWith("0")) {
                              if (!val.startsWith("0.")) {
                                val = val.replace(/^0+/, "");
                              }
                            }
                            if (Number(val) > 100) {
                              val = "100";
                            }
                            setLoanAllocationPercentage(val);
                          }}
                          onBlur={() => markTouched("loanAllocationPercentage")}
                          value={loanAllocationPercentage}
                          style={{
                            width: "100%",
                            height: "44px",
                            padding: "0 32px 0 16px",
                            background: hasLoan ? (isDark ? "var(--surface-2)" : "#ffffff") : (isDark ? "var(--surface-1)" : "#f1f5f9"),
                            border: touchedFields.loanAllocationPercentage && !isLoanAllocationValid ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                            borderRadius: "8px",
                            fontSize: "14px",
                            color: hasLoan ? (isDark ? "var(--text-primary)" : "#101828") : (isDark ? "var(--text-muted)" : "#94a3b8"),
                            cursor: hasLoan ? "text" : "not-allowed"
                          }}
                        />
                        <span style={{ position: "absolute", right: "16px", fontSize: "14px", color: isDark ? "var(--text-secondary)" : "#667085" }}>%</span>
                      </div>
                      {touchedFields.loanAllocationPercentage && !isLoanAllocationValid && (
                        <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                          {!loanAllocationPercentage
                            ? "Loan allocation is required."
                            : Number(loanAllocationPercentage) === 0
                              ? "Loan allocation percentage cannot be 0."
                              : "Loan Allocation percentage must be greater than 0% and at most 100%."}
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: isDark ? "var(--text-secondary)" : "#344054", marginBottom: "8px" }}>
                        Loan account number {hasLoan && <em style={{ color: "#d92d20", fontStyle: "normal" }}>*</em>}
                      </label>
                      <input
                        type="text"
                        placeholder={hasLoan ? "Enter account number" : "No loan"}
                        value={loanAccountNumber}
                        disabled={!hasLoan}
                        onChange={(e) => setLoanAccountNumber(e.target.value.replace(/\D/g, ""))}
                        onBlur={() => markTouched("loanAccountNumber")}
                        style={{
                          width: "100%",
                          height: "44px",
                          padding: "0 16px",
                          background: hasLoan ? (isDark ? "var(--surface-2)" : "#ffffff") : (isDark ? "var(--surface-1)" : "#f1f5f9"),
                          border: touchedFields.loanAccountNumber && !isLoanAccountNumberValid ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                          borderRadius: "8px",
                          fontSize: "14px",
                          color: hasLoan ? (isDark ? "var(--text-primary)" : "#101828") : (isDark ? "var(--text-muted)" : "#94a3b8"),
                          outline: "none",
                          cursor: hasLoan ? "text" : "not-allowed"
                        }}
                      />
                      {touchedFields.loanAccountNumber && !isLoanAccountNumberValid && (
                        <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                          {!loanAccountNumber.trim() ? "Loan Account Number is required." : "Loan Account Number must contain numeric values only."}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ marginBottom: "10px" }}>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: isDark ? "var(--text-secondary)" : "#344054", marginBottom: "8px" }}>
                      Loan amount {hasLoan && <em style={{ color: "#d92d20", fontStyle: "normal" }}>*</em>}
                    </label>
                    <input
                      type="text"
                      placeholder={hasLoan ? "Enter amount" : "No loan"}
                      value={loanAmount}
                      disabled={!hasLoan}
                      onChange={(e) => setLoanAmount(formatAUD(e.target.value))}
                      onBlur={() => markTouched("loanAmount")}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 16px",
                        background: hasLoan ? (isDark ? "var(--surface-2)" : "#ffffff") : (isDark ? "var(--surface-1)" : "#f1f5f9"),
                        border: touchedFields.loanAmount && !isLoanAmountValid ? "1px solid #fca5a5" : `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`,
                        borderRadius: "8px",
                        fontSize: "14px",
                        color: hasLoan ? (isDark ? "var(--text-primary)" : "#101828") : (isDark ? "var(--text-muted)" : "#94a3b8"),
                        outline: "none",
                        cursor: hasLoan ? "text" : "not-allowed"
                      }}
                    />
                    {touchedFields.loanAmount && !isLoanAmountValid && (
                      <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                        {!loanAmount.trim() 
                          ? "Loan Amount is required." 
                          : (Number.parseFloat(loanAmount.replace(/[^0-9.-]/g, "")) <= 0 || isNaN(Number.parseFloat(loanAmount.replace(/[^0-9.-]/g, ""))))
                            ? "Loan Amount must be greater than 0." 
                            : `Loan Amount must accept only currency format (${CURRENCY_PREFIX}).`}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div style={{ padding: "12px 16px", background: isDark ? "rgba(240, 149, 149, 0.12)" : "#fef2f2", border: `1px solid ${isDark ? "var(--border)" : "#fca5a5"}`, borderRadius: "8px", color: isDark ? "var(--danger)" : "#991b1b", fontSize: "14px" }}>
                  {errorMessage}
                </div>
              )}

              {/* Step 2 Footer */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px", background: isDark ? "var(--surface-1)" : "#ffffff", borderRadius: "12px", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}`, padding: "16px 24px" }}>
                <button type="button" onClick={() => setStep(1)} style={{ height: "44px", padding: "0 20px", background: isDark ? "var(--surface-2)" : "#ffffff", border: `1px solid ${isDark ? "var(--border)" : "#d0d5dd"}`, borderRadius: "8px", fontSize: "15px", fontWeight: 600, color: isDark ? "var(--text-primary)" : "#344054" }}>Back</button>
                <button type="button" disabled={isSaving || !isStep2Valid || !isLoanDetailsValid} onClick={handleSave} style={{ height: "44px", padding: "0 24px", background: (isStep2Valid && isLoanDetailsValid) ? (isDark ? "var(--accent)" : "#1a235a") : (isDark ? "var(--surface-2)" : "#cbd5e1"), border: "none", borderRadius: "8px", fontSize: "15px", fontWeight: 600, color: (isStep2Valid && isLoanDetailsValid) ? (isDark ? "#0f1330" : "#ffffff") : (isDark ? "var(--text-muted)" : "#ffffff"), cursor: (isStep2Valid && isLoanDetailsValid) ? "pointer" : "not-allowed" }}>
                  {isSaving ? "Saving..." : (mode === "edit" ? "Save changes" : "Save and add property")}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Success Overlay */}
        {saved && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: isDark ? "rgba(0, 0, 0, 0.6)" : "rgba(16, 24, 40, 0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: isDark ? "var(--surface-1)" : "#ffffff", borderRadius: "24px", padding: "36px 24px", width: "90%", maxWidth: "440px", textAlign: "center", boxShadow: "0px 20px 48px rgba(16, 24, 40, 0.12)", border: `1px solid ${isDark ? "var(--border)" : "#eaeef4"}` }}>
              <div style={{ width: "80px", height: "80px", margin: "0 auto 24px auto", borderRadius: "50%", background: isDark ? "rgba(93, 202, 165, 0.12)" : "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke={isDark ? "var(--success)" : "#10b981"} strokeWidth="3" style={{ width: "40px", height: "40px" }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: 800, color: isDark ? "var(--text-primary)" : "#101828", margin: "0 0 12px 0" }}>
                {mode === "edit" ? "Property Updated Successfully" : "Property Added Successfully"}
              </h3>
              <p style={{ fontSize: "14px", color: isDark ? "var(--text-secondary)" : "#667085", margin: "0 0 28px 0" }}>
                <strong>{propertyName}</strong> {mode === "edit" ? "has been updated successfully." : <>is now linked to <strong>{selectedEntity?.name}</strong>.</>}
              </p>
              <Link href={onSuccessUrl} style={{ display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", height: "44px", width: "100%", background: isDark ? "var(--accent)" : "#1a235a", borderRadius: "8px", fontSize: "15px", fontWeight: 600, color: isDark ? "#0f1330" : "#ffffff", textDecoration: "none" }}>View Properties List</Link>
            </div>
          </div>
        )}
      </div>
    );
  };

  return isMobile ? renderMobileView() : renderDesktopView();
}
