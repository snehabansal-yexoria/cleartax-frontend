"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "boneyard-js/react";
import { PropertyDetailSkeleton } from "@/app/components/PortalSkeletons";
import { getSession } from "@/src/lib/session";
import type {
  CoreEntity,
  CoreProperty,
  CoreTransactionListItem,
  CoreTransactionCategory,
  CoreTransactionSubcategory,
} from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

type SubcategoryLine = {
  id: string;
  subcategoryId: number;
  label: string;
  amount: string;
  use: string;
};

type ReviewLine = {
  id: string;
  categoryId?: number;
  label: string;
  amount: string;
  use: string;
  expandable?: boolean;
  subcategories?: SubcategoryLine[];
  initialParentAmount?: string;
};

type OwnerLine = {
  id: string;
  name: string;
  percentage: string;
};

type LogitFormReviewProps = {
  propertyId: string;
  backHref: string;
};

function getOwnerNameError(name: string): string | null {
  if (!name || name.trim() === "") {
    return "Owner name is required.";
  }
  if (name.startsWith(" ") || name.endsWith(" ")) {
    return "Owner name cannot have leading or trailing spaces.";
  }
  if (/\s{2,}/.test(name)) {
    return "Owner name cannot contain multiple consecutive spaces.";
  }
  if (/\d/.test(name)) {
    return "Owner name cannot contain numbers.";
  }
  if (/[^a-zA-Z\s'-]/.test(name)) {
    return "Owner name cannot contain special characters.";
  }
  if (name.length === 1) {
    return "Owner name must be at least 2 characters.";
  }
  if (name.length > 100) {
    return "Owner name cannot exceed 100 characters.";
  }
  if (!/[a-zA-Z]/.test(name)) {
    return "Owner name cannot contain only symbols.";
  }
  return null;
}

function getCategoryRowId(name: string): string {
  const legacyMap: Record<string, string> = {
    "advertising for tenants": "advertising",
    "body corporate fees / strata levy": "body-corporate",
    "cleaning": "cleaning",
    "council rates": "council-rates",
    "gardening / lawn mowing": "gardening-a",
    "insurance": "insurance",
    "land tax": "land-tax",
    "legal fees": "legal-fees",
    "pest control": "pest-control",
    "property agent fees / commission": "agent-fees",
    "repairs and maintenance": "repairs",
    "water charges": "water",
    "sundry rental expenses": "sundry",
    "interest on loans - tbd": "interest",
    "borrowing expenses": "borrowing",
    "capital allowances": "capital-allowances",
    "capital works deductions": "capital-works",
    "rental income": "rental-income",
    "other rental income": "other-rental-income",
  };
  const norm = name.toLowerCase().trim();
  return legacyMap[norm] || norm.replace(/[^a-z0-9]+/g, "-");
}

const EXPANDABLE_CATEGORY_NAMES = new Set([
  "other rental income",
  "insurance",
  "legal fees",
  "property agent fees / commission",
  "repairs and maintenance",
  "sundry rental expenses",
  "interest on loans - tbd",
  "borrowing expenses",
]);



function titleCase(value: string) {
  if (!value) return "";
  return value
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

const CURRENCY_SYMBOL = "A$ ";

function formatMoney(value: number) {
  const formattedNumber = new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
  return `${CURRENCY_SYMBOL}${formattedNumber}`;
}

function toInputDate(value: string | null | undefined) {
  return value?.slice(0, 10) || "";
}

function getLoanDetail(property: CoreProperty | null, key: string) {
  const value = property?.loanDetails?.[key];
  return value == null ? "" : String(value);
}

function getRowsTotal(rows: ReviewLine[], key: "amount" | "use") {
  return rows.reduce((sum, row) => {
    const amount = Number.parseFloat(row[key]);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

function getRowsClaimableTotal(rows: ReviewLine[]): number {
  return rows.reduce((sum, row) => {
    const amount = Number.parseFloat(row.amount);
    const use = Number.parseFloat(row.use);
    const amt = Number.isFinite(amount) ? amount : 0;
    const u = Number.isFinite(use) ? use : 0;
    return sum + (amt * u) / 100;
  }, 0);
}

function inputNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "";
}

function syncParentWithSubcategories(row: ReviewLine): ReviewLine {
  if (!row.subcategories || row.subcategories.length === 0) return row;

  const totalAmount = row.subcategories.reduce((sum, s) => {
    const val = Number.parseFloat(s.amount);
    return sum + (Number.isFinite(val) ? val : 0);
  }, 0);

  const initialAmt = Number.parseFloat(row.initialParentAmount || "0.00") || 0;
  const parentAmount = initialAmt + totalAmount;

  const sumAmounts = row.subcategories.reduce((sum, s) => sum + (Number.parseFloat(s.amount) || 0), 0);
  let averageUse = 0;
  if (sumAmounts > 0) {
    const sumWeightedUse = row.subcategories.reduce((sum, s) => {
      const amt = Number.parseFloat(s.amount) || 0;
      const useVal = Number.parseFloat(s.use) || 0;
      return sum + (amt * useVal);
    }, 0);
    averageUse = sumWeightedUse / sumAmounts;
  } else {
    const validUses = row.subcategories.map(s => Number.parseFloat(s.use)).filter(Number.isFinite);
    averageUse = validUses.length > 0 ? validUses.reduce((s, u) => s + u, 0) / validUses.length : 0;
  }

  let finalUse = averageUse.toFixed(2);
  if (sumAmounts === 0) {
    finalUse = Number.parseFloat(row.use || "0.00").toFixed(2);
  }

  return {
    ...row,
    amount: parentAmount.toFixed(2),
    use: finalUse,
  };
}

export default function LogitFormReview({
  propertyId,
  backHref,
}: LogitFormReviewProps) {
  const router = useRouter();
  const [property, setProperty] = useState<CoreProperty | null>(null);
  const [entity, setEntity] = useState<CoreEntity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [locality, setLocality] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [postcode, setPostcode] = useState("");
  const [locationText, setLocationText] = useState("");
  const [acquisitionDate, setAcquisitionDate] = useState("");
  const [acquisitionCost, setAcquisitionCost] = useState("");
  const [disposalDate, setDisposalDate] = useState("");
  const [disposalProceeds, setDisposalProceeds] = useState("");
  const [dateFirstEarnedRent, setDateFirstEarnedRent] = useState("");
  const [weeksRented, setWeeksRented] = useState("52");
  const [weeksAvailable, setWeeksAvailable] = useState("");
  const [dateAvailable, setDateAvailable] = useState("");
  const [hasLoan, setHasLoan] = useState(false);
  const [owners, setOwners] = useState<OwnerLine[]>([]);
  const [rentedIncome, setRentedIncome] = useState<ReviewLine[]>([]);
  const [rentedExpenses, setRentedExpenses] = useState<ReviewLine[]>([]);
  const [borrowings, setBorrowings] = useState<ReviewLine[]>([]);
  const [depreciation, setDepreciation] = useState<ReviewLine[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [subcategoryOptionsMap, setSubcategoryOptionsMap] = useState<
    Record<string, { id: number; name: string }[]>
  >({});
  const [subSums, setSubSums] = useState<Record<string, number>>({});

  const nameValidationTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timeouts = nameValidationTimeouts.current;
    return () => {
      Object.values(timeouts).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) {
          router.replace("/login/user");
          return;
        }

        const token = session.getIdToken().getJwtToken();

        // 1. Fetch property and categories
        const [propertyRes, categoriesRes, revenueRes] = await Promise.all([
          fetch(`/api/properties/${encodeURIComponent(propertyId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/transactions/categories?type=expense`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/transactions/categories?type=revenue`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (cancelled) return;
        if (!propertyRes.ok) {
          setLoadError("Failed to load the property review form.");
          return;
        }

        const loadedProperty = (await propertyRes.json()) as CoreProperty;
        setProperty(loadedProperty);
        setHasLoan(Boolean(loadedProperty.loanDetails));
        setOwners(
          loadedProperty.owners.length > 0
            ? loadedProperty.owners.map((owner, index) => ({
              id: String(owner.id ?? index),
              name: owner.ownerName,
              percentage: inputNumber(owner.ownershipPercentage),
            }))
            : [{ id: "primary", name: "", percentage: "100" }],
        );

        let fetchedCategories: CoreTransactionCategory[] = [];
        if (categoriesRes.ok) {
          const catData = (await categoriesRes.json()) as { items?: CoreTransactionCategory[] };
          fetchedCategories = [...fetchedCategories, ...(catData.items ?? [])];
        }
        if (revenueRes.ok) {
          const revData = (await revenueRes.json()) as { items?: CoreTransactionCategory[] };
          fetchedCategories = [...fetchedCategories, ...(revData.items ?? [])];
        }

        // Sort categories by database ID numerically to keep consistent rendering order
        fetchedCategories.sort((a, b) => Number(a.id) - Number(b.id));

        if (cancelled) return;

        // 2. Build dynamic row arrays
        const initialIncome: ReviewLine[] = [];
        const initialExpenses: ReviewLine[] = [];
        const initialBorrowings: ReviewLine[] = [];
        const initialDepreciation: ReviewLine[] = [];

        for (const cat of fetchedCategories) {
          const nameLower = cat.name.toLowerCase().trim();
          const rowId = getCategoryRowId(cat.name);

          // Determine expandability: check if name is in EXPANDABLE_CATEGORY_NAMES Set
          const isExpandable = EXPANDABLE_CATEGORY_NAMES.has(nameLower);

          const row: ReviewLine = {
            id: rowId,
            categoryId: cat.id,
            label: cat.name,
            amount: "0.00",
            use: "0.00",
            expandable: isExpandable,
          };

          if (cat.type === "revenue") {
            initialIncome.push(row);
          } else {
            if (nameLower === "interest on loans - tbd" || nameLower === "borrowing expenses") {
              initialBorrowings.push(row);
            } else if (nameLower === "capital allowances" || nameLower === "capital works deductions") {
              initialDepreciation.push(row);
            } else {
              initialExpenses.push(row);
            }
          }
        }

        // 4. Fetch Logit data & merge with the categories
        const logitRes = await fetch(
          `/api/properties/${encodeURIComponent(propertyId)}/logit`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        let savedIncome = [...initialIncome];
        let savedExpenses = [...initialExpenses];
        let savedBorrowings = [...initialBorrowings];
        let savedDepreciation = [...initialDepreciation];

        if (!cancelled && logitRes.ok) {
          const saved = (await logitRes.json()) as Record<string, unknown>;
          const addr = saved.address as Record<string, string> | undefined;
          const acq = saved.acquisition as Record<string, string> | undefined;
          const disp = saved.disposal as Record<string, string> | undefined;
          const rent = saved.rental_period as
            | Record<string, string>
            | undefined;
          const incRows = saved.income_rows as
            | { id: string; amount: string; use: string }[]
            | undefined;
          const expRows = saved.expense_rows as
            | { id: string; amount: string; use: string }[]
            | undefined;
          const borRows = saved.borrowing_rows as
            | { id: string; amount: string; use: string }[]
            | undefined;
          const depRows = saved.depreciation_rows as
            | { id: string; amount: string; use: string }[]
            | undefined;

          setAddressLine1(addr?.line1 ?? loadedProperty.locationText ?? loadedProperty.name);
          setAddressLine2(addr?.line2 ?? "");
          setLocality(addr?.locality ?? "");
          setStateValue(addr?.state ?? "");
          setPostcode(addr?.postcode ?? "");
          setLocationText(addr?.locationText ?? loadedProperty.locationText ?? "");
          setAcquisitionDate(acq?.date ?? toInputDate(loadedProperty.purchaseDate));
          setAcquisitionCost(acq?.cost ?? inputNumber(loadedProperty.purchaseAmount));
          setDisposalDate(disp?.date ?? "");
          setDisposalProceeds(disp?.proceeds ?? "");
          setDateFirstEarnedRent(rent?.date_first_earned_rent ?? "");
          setWeeksRented(rent?.weeks_rented ?? "52");
          setWeeksAvailable(rent?.weeks_available ?? "");
          setDateAvailable(rent?.date_available ?? "");

          const mapSubcategories = (subs: SubcategoryLine[]) =>
            subs.map((s) => ({
              ...s,
              amount: s.amount === "" || !s.amount ? "0.00" : Number.parseFloat(s.amount).toFixed(2),
              use: s.use === "" || !s.use ? "0.00" : Number.parseFloat(s.use).toFixed(2),
            }));

          const loadRowData = (
            prev: ReviewLine[],
            savedRows: { id: string; amount: string; use: string; subcategories?: SubcategoryLine[] }[],
          ) =>
            prev.map((row) => {
              const saved = savedRows.find((r) => r.id === row.id);
              if (saved) {
                const hasSubs = !!(saved.subcategories && saved.subcategories.length > 0);
                const savedAmt = saved.amount === "" || !saved.amount ? "0.00" : Number.parseFloat(saved.amount).toFixed(2);
                const savedUse = saved.use === "" || !saved.use ? "0.00" : Number.parseFloat(saved.use).toFixed(2);
                const initialParentAmount = hasSubs ? "0.00" : savedAmt;

                return syncParentWithSubcategories({
                  ...row,
                  amount: savedAmt,
                  use: savedUse,
                  initialParentAmount,
                  subcategories: saved.subcategories ? mapSubcategories(saved.subcategories) : undefined,
                });
              }
              return { ...row, amount: "0.00", use: "0.00", initialParentAmount: "0.00" };
            });

          if (incRows && incRows.length > 0) {
            savedIncome = loadRowData(savedIncome, incRows);
          } else {
            savedIncome = savedIncome.map((row) => ({ ...row, amount: "0.00", use: "0.00", initialParentAmount: "0.00" }));
            setAddressLine1(loadedProperty.locationText || loadedProperty.name);
            setLocationText(loadedProperty.locationText || "");
            setAcquisitionDate(toInputDate(loadedProperty.purchaseDate));
            setAcquisitionCost(loadedProperty.purchaseAmount != null ? Number(loadedProperty.purchaseAmount).toFixed(2) : "");
          }

          if (expRows && expRows.length > 0) {
            savedExpenses = loadRowData(savedExpenses, expRows);
          } else {
            savedExpenses = savedExpenses.map((row) => ({ ...row, amount: "0.00", use: "0.00", initialParentAmount: "0.00" }));
          }

          if (borRows && borRows.length > 0) {
            savedBorrowings = loadRowData(savedBorrowings, borRows);
          } else {
            savedBorrowings = savedBorrowings.map((row) => ({ ...row, amount: "0.00", use: "0.00", initialParentAmount: "0.00" }));
          }

          if (depRows && depRows.length > 0) {
            savedDepreciation = loadRowData(savedDepreciation, depRows);
          } else {
            savedDepreciation = savedDepreciation.map((row) => ({ ...row, amount: "0.00", use: "0.00", initialParentAmount: "0.00" }));
          }
        } else {
          savedIncome = savedIncome.map((row) => ({ ...row, amount: "0.00", use: "0.00", initialParentAmount: "0.00" }));
          savedExpenses = savedExpenses.map((row) => ({ ...row, amount: "0.00", use: "0.00", initialParentAmount: "0.00" }));
          savedBorrowings = savedBorrowings.map((row) => ({ ...row, amount: "0.00", use: "0.00", initialParentAmount: "0.00" }));
          savedDepreciation = savedDepreciation.map((row) => ({ ...row, amount: "0.00", use: "0.00", initialParentAmount: "0.00" }));
          setAddressLine1(loadedProperty.locationText || loadedProperty.name);
          setLocationText(loadedProperty.locationText || "");
          setAcquisitionDate(toInputDate(loadedProperty.purchaseDate));
          setAcquisitionCost(loadedProperty.purchaseAmount != null ? Number(loadedProperty.purchaseAmount).toFixed(2) : "");
        }

        // 5. Fetch transactions & apply dynamic sums
        const [entityRes, txRes] = await Promise.all([
          fetch(`/api/entities/${encodeURIComponent(loadedProperty.entityId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/entities/${encodeURIComponent(loadedProperty.entityId)}/transactions`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!cancelled && entityRes.ok) {
          setEntity((await entityRes.json()) as CoreEntity);
        }

        if (!cancelled && txRes.ok) {
          const txData = (await txRes.json()) as { items?: CoreTransactionListItem[] };
          const txs = (txData.items ?? []).filter((t) =>
            t.propertyIds.includes(propertyId),
          );

          const sums: Record<string, number> = {};
          const computedSubSums: Record<string, number> = {};
          for (const tx of txs) {
            const rowId = getCategoryRowId(tx.categoryName);
            if (rowId) {
              sums[rowId] = (sums[rowId] ?? 0) + Math.abs(tx.grossAmount);
            }
            if (tx.subcategoryId) {
              const key = String(tx.subcategoryId);
              computedSubSums[key] = (computedSubSums[key] ?? 0) + Math.abs(tx.grossAmount);
            }
            if (tx.subcategoryName) {
              const keyName = tx.subcategoryName.toLowerCase().trim();
              computedSubSums[keyName] = (computedSubSums[keyName] ?? 0) + Math.abs(tx.grossAmount);
            }
          }
          setSubSums(computedSubSums);

          const applyTxSums = (rows: ReviewLine[]) =>
            rows.map((row) => {
              // 1. Fill empty subcategories with their transaction amounts
              let hasChangedSub = false;
              const updatedSubcategories = row.subcategories?.map((sub) => {
                const isAmountEmpty = sub.amount === "0.00" || sub.amount === "0" || sub.amount === "";
                if (!isAmountEmpty) return sub;

                const subId = String(sub.subcategoryId);
                const subName = sub.label.toLowerCase().trim();
                const subSum = computedSubSums[subId] ?? computedSubSums[subName];

                if (subSum != null && subSum > 0) {
                  hasChangedSub = true;
                  return { ...sub, amount: subSum.toFixed(2) };
                }
                return sub;
              });

              let rowWithUpdatedSubs: ReviewLine = {
                ...row,
                subcategories: updatedSubcategories,
              };

              // 2. Adjust parent amount to avoid double counting the subcategories
              if (hasChangedSub && updatedSubcategories && updatedSubcategories.length > 0) {
                const subcategoriesTotal = updatedSubcategories.reduce((sum, sub) => sum + (parseFloat(sub.amount) || 0), 0);
                const parentInitial = parseFloat(row.initialParentAmount || "0.00") || 0;

                // Subtract subcategories sum from initial parent amount
                const newInitial = Math.max(0, parentInitial - subcategoriesTotal);
                rowWithUpdatedSubs.initialParentAmount = newInitial.toFixed(2);
                rowWithUpdatedSubs = syncParentWithSubcategories(rowWithUpdatedSubs);
              }

              if (rowWithUpdatedSubs.amount !== "0.00" && rowWithUpdatedSubs.amount !== "0" && rowWithUpdatedSubs.amount !== "") {
                return rowWithUpdatedSubs;
              }

              const sum = sums[row.id];
              if (sum != null && sum > 0) {
                const amtStr = sum.toFixed(2);
                const hasSavedSubs = !!(rowWithUpdatedSubs.subcategories && rowWithUpdatedSubs.subcategories.length > 0);
                return {
                  ...rowWithUpdatedSubs,
                  amount: amtStr,
                  initialParentAmount: hasSavedSubs ? "0.00" : amtStr,
                };
              }
              return rowWithUpdatedSubs;
            });

          savedIncome = applyTxSums(savedIncome);
          savedExpenses = applyTxSums(savedExpenses);
          savedBorrowings = applyTxSums(savedBorrowings);
          savedDepreciation = applyTxSums(savedDepreciation);
        }

        if (!cancelled) {
          setRentedIncome(savedIncome);
          setRentedExpenses(savedExpenses);
          setBorrowings(savedBorrowings);
          setDepreciation(savedDepreciation);
        }

      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load logit form review:", error);
          setLoadError("Unexpected error loading the property review form.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (propertyId) load();
    return () => {
      cancelled = true;
    };
  }, [propertyId, router]);

  const totals = useMemo(() => {
    const incomeAmount = getRowsTotal(rentedIncome, "amount");
    const incomeUse = getRowsClaimableTotal(rentedIncome);
    const rentalExpenseAmount = getRowsTotal(rentedExpenses, "amount");
    const rentalExpenseUse = getRowsClaimableTotal(rentedExpenses);
    const borrowingAmount = getRowsTotal(borrowings, "amount");
    const borrowingUse = getRowsClaimableTotal(borrowings);
    const depreciationAmount = getRowsTotal(depreciation, "amount");
    const depreciationUse = getRowsClaimableTotal(depreciation);

    const expenseAmount =
      rentalExpenseAmount +
      borrowingAmount +
      depreciationAmount;

    const expenseUse =
      rentalExpenseUse +
      borrowingUse +
      depreciationUse;

    return {
      incomeAmount,
      incomeUse,
      rentalExpenseAmount,
      rentalExpenseUse,
      borrowingAmount,
      borrowingUse,
      depreciationAmount,
      depreciationUse,
      expenseAmount,
      expenseUse,
    };
  }, [borrowings, depreciation, rentedExpenses, rentedIncome]);

  function updateOwner(id: string, key: "name" | "percentage", value: string) {
    setOwners((current) =>
      current.map((owner) =>
        owner.id === id ? { ...owner, [key]: value } : owner,
      ),
    );
  }

  function addOwner() {
    setOwners((current) => [
      ...current,
      { id: crypto.randomUUID(), name: "", percentage: "" },
    ]);
  }

  function updateLine(
    group: "income" | "expenses" | "borrowings" | "depreciation",
    id: string,
    key: "amount" | "use",
    value: string,
  ) {
    const updater = (rows: ReviewLine[]) =>
      rows.map((row) => (row.id === id ? { ...row, [key]: value } : row));

    if (group === "income") setRentedIncome(updater);
    if (group === "expenses") setRentedExpenses(updater);
    if (group === "borrowings") setBorrowings(updater);
    if (group === "depreciation") setDepreciation(updater);
  }

  async function onToggleExpand(rowId: string) {
    const allRows = [...rentedIncome, ...rentedExpenses, ...borrowings, ...depreciation];
    const row = allRows.find((r) => r.id === rowId);
    if (!row) return;

    setExpandedRows((prev) => {
      const isExpanded = !prev[rowId];
      return { ...prev, [rowId]: isExpanded };
    });

    const optionsExist = !!subcategoryOptionsMap[rowId];

    const applyOptionsToRow = (options: { id: number; name: string }[]) => {
      const initializeSubs = (rows: ReviewLine[]) =>
        rows.map((r) => {
          if (r.id !== rowId) return r;

          const currentSubs = (r.subcategories ?? []).map((sub) => ({
            ...sub,
            amount: sub.amount === "" || !sub.amount ? "0.00" : Number.parseFloat(sub.amount).toFixed(2),
            use: sub.use === "" || !sub.use ? "0.00" : Number.parseFloat(sub.use).toFixed(2),
          }));
          const mergedSubs = [...currentSubs];
          const wasEmpty = !r.subcategories || r.subcategories.length === 0;

          for (const opt of options) {
            const exists = currentSubs.some(
              (s) => s.subcategoryId === opt.id || s.label.toLowerCase().trim() === opt.name.toLowerCase().trim()
            );
            if (!exists) {
              const subId = String(opt.id);
              const subName = opt.name.toLowerCase().trim();
              const subSum = subSums[subId] ?? subSums[subName];
              const amountStr = subSum != null && subSum > 0 ? subSum.toFixed(2) : "0.00";

              mergedSubs.push({
                id: crypto.randomUUID(),
                subcategoryId: opt.id,
                label: opt.name,
                amount: amountStr,
                use: "0.00",
              });
            }
          }

          mergedSubs.sort((a, b) => {
            const aIdx = options.findIndex((o) => o.id === a.subcategoryId || o.name.toLowerCase().trim() === a.label.toLowerCase().trim());
            const bIdx = options.findIndex((o) => o.id === b.subcategoryId || o.name.toLowerCase().trim() === b.label.toLowerCase().trim());
            return aIdx - bIdx;
          });

          const updatedRow = {
            ...r,
            subcategories: mergedSubs,
          };

          if (wasEmpty) {
            const subcategoriesTotal = mergedSubs.reduce((sum, sub) => sum + (parseFloat(sub.amount) || 0), 0);
            const parentInitial = parseFloat(r.initialParentAmount || "0.00") || 0;
            const newInitial = Math.max(0, parentInitial - subcategoriesTotal);
            updatedRow.initialParentAmount = newInitial.toFixed(2);
          }

          return syncParentWithSubcategories(updatedRow);
        });

      setRentedIncome(initializeSubs);
      setRentedExpenses(initializeSubs);
      setBorrowings(initializeSubs);
      setDepreciation(initializeSubs);
    };

    if (!optionsExist && row.categoryId) {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (session) {
          const token = session.getIdToken().getJwtToken();
          const subRes = await fetch(
            `/api/transactions/categories/${row.categoryId}/sub-categories`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (subRes.ok) {
            const subData = (await subRes.json()) as { items?: CoreTransactionSubcategory[] };
            const options = (subData.items ?? []).map((s) => ({
              id: s.id,
              name: s.name,
            }));

            setSubcategoryOptionsMap((prev) => ({
              ...prev,
              [rowId]: options,
            }));

            applyOptionsToRow(options);
          }
        }
      } catch (err) {
        console.error("Failed to fetch subcategories on demand:", err);
      }
    } else if (optionsExist) {
      applyOptionsToRow(subcategoryOptionsMap[rowId]);
    }
  }

  function updateSubcategoryLine(
    group: "income" | "expenses" | "borrowings" | "depreciation",
    parentId: string,
    subId: string,
    key: "label" | "amount" | "use" | "subcategoryId",
    value: string | number,
  ) {
    const updater = (rows: ReviewLine[]) =>
      rows.map((row) => {
        if (row.id !== parentId) return row;
        const currentSubs = row.subcategories ?? [];
        const updatedSubs = currentSubs.map((sub) =>
          sub.id === subId ? { ...sub, [key]: value } : sub
        );

        return syncParentWithSubcategories({
          ...row,
          subcategories: updatedSubs,
        });
      });

    if (group === "income") setRentedIncome(updater);
    if (group === "expenses") setRentedExpenses(updater);
    if (group === "borrowings") setBorrowings(updater);
    if (group === "depreciation") setDepreciation(updater);
  }

  async function handleSubmit() {
    setFormError("");
    setFieldErrors({});
    setSuccessMessage("");

    const ownershipTotal = owners.reduce((sum, owner) => {
      const value = Number.parseFloat(owner.percentage);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    const newFieldErrors: Record<string, string> = {};

    if (!locationText.trim()) {
      newFieldErrors.locationText = "Property Location is required.";
    }
    if (!addressLine1.trim()) {
      newFieldErrors.addressLine1 = "Address Line 1 is required.";
    }
    if (!locality.trim()) {
      newFieldErrors.locality = "Locality is required.";
    }
    if (!stateValue.trim()) {
      newFieldErrors.stateValue = "State is required.";
    }
    if (!postcode.trim()) {
      newFieldErrors.postcode = "Postcode is required.";
    }

    let ownersHasError = false;
    owners.forEach((owner) => {
      const nameError = getOwnerNameError(owner.name);
      if (nameError) {
        newFieldErrors[`owner_name_${owner.id}`] = nameError;
        ownersHasError = true;
      }

      if (!owner.percentage.trim()) {
        newFieldErrors[`owner_percentage_${owner.id}`] = "Ownership percentage is required.";
        ownersHasError = true;
      }
    });

    if (ownersHasError) {
      newFieldErrors.owners = "Please correct the owner information.";
    } else if (ownershipTotal <= 0 || ownershipTotal > 100) {
      newFieldErrors.owners = "Ownership percentage must be greater than 0 and no more than 100.";
    }

    if (weeksRented !== "") {
      const rentedWeeks = Number(weeksRented);
      if (Number.isNaN(rentedWeeks) || rentedWeeks < 0 || rentedWeeks > 52) {
        newFieldErrors.weeksRented = "Weeks rented during year must be between 0 and 52.";
      }
    }

    if (weeksAvailable !== "") {
      const availableWeeks = Number(weeksAvailable);
      if (Number.isNaN(availableWeeks) || availableWeeks < 0 || availableWeeks > 52) {
        newFieldErrors.weeksAvailable = "Weeks available for rent must be between 0 and 52.";
      }
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      setFormError("Complete the required fields before lodging.");

      const firstErrorKey = Object.keys(newFieldErrors)[0];
      const element = document.getElementById(firstErrorKey);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.focus();
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) {
        router.replace("/login/user");
        return;
      }
      const token = session.getIdToken().getJwtToken();
      const payload = {
        address: {
          line1: addressLine1,
          line2: addressLine2,
          locality,
          state: stateValue,
          postcode,
          locationText,
        },
        acquisition: { date: acquisitionDate, cost: acquisitionCost },
        disposal: { date: disposalDate, proceeds: disposalProceeds },
        rental_period: {
          date_first_earned_rent: dateFirstEarnedRent,
          weeks_rented: weeksRented,
          weeks_available: weeksAvailable,
          date_available: dateAvailable,
        },
        income_rows: rentedIncome.map(({ id, amount, use, subcategories }) => ({
          id,
          amount: amount === "" || !amount ? "0" : amount,
          use: use === "" || !use ? "0" : use,
          subcategories: subcategories
            ? subcategories.map((s) => ({
              ...s,
              amount: s.amount === "" || !s.amount ? "0" : s.amount,
              use: s.use === "" || !s.use ? "0" : s.use,
            }))
            : undefined,
        })),
        expense_rows: rentedExpenses.map(({ id, amount, use, subcategories }) => ({
          id,
          amount: amount === "" || !amount ? "0" : amount,
          use: use === "" || !use ? "0" : use,
          subcategories: subcategories
            ? subcategories.map((s) => ({
              ...s,
              amount: s.amount === "" || !s.amount ? "0" : s.amount,
              use: s.use === "" || !s.use ? "0" : s.use,
            }))
            : undefined,
        })),
        borrowing_rows: borrowings.map(({ id, amount, use, subcategories }) => ({
          id,
          amount: amount === "" || !amount ? "0" : amount,
          use: use === "" || !use ? "0" : use,
          subcategories: subcategories
            ? subcategories.map((s) => ({
              ...s,
              amount: s.amount === "" || !s.amount ? "0" : s.amount,
              use: s.use === "" || !s.use ? "0" : s.use,
            }))
            : undefined,
        })),
        depreciation_rows: depreciation.map(({ id, amount, use, subcategories }) => ({
          id,
          amount: amount === "" || !amount ? "0" : amount,
          use: use === "" || !use ? "0" : use,
          subcategories: subcategories
            ? subcategories.map((s) => ({
              ...s,
              amount: s.amount === "" || !s.amount ? "0" : s.amount,
              use: s.use === "" || !s.use ? "0" : s.use,
            }))
            : undefined,
        })),
      };
      const res = await fetch(
        `/api/properties/${encodeURIComponent(propertyId)}/logit`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        setFormError("Failed to save. Please try again.");
        return;
      }
      setSuccessMessage(
        "Logit form reviewed successfully. The export is ready to lodge.",
      );
    } catch (error) {
      console.error("Failed to save logit form:", error);
      setFormError("Unexpected error saving. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Skeleton
        name="logit-form-review-page"
        loading
        fallback={<PropertyDetailSkeleton />}
      >
        <PropertyDetailSkeleton />
      </Skeleton>
    );
  }

  if (!property) {
    return (
      <section className="client-detail-page property-detail-page property-detail-shell">
        <Link href={backHref} className="entity-wizard-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back to Property
        </Link>
        <p className="entity-wizard-error">
          {loadError || "Property review form not found."}
        </p>
      </section>
    );
  }

  return (
    <section className="client-detail-page logit-review-page property-detail-shell">
      <Link href={backHref} className="entity-wizard-back">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Back to Property
      </Link>

      <header className="logit-review-head">
        <div>
          <h1>Logit Form Review</h1>
          <p>
            Review and validate all rental property information before
            submission
          </p>
        </div>
      </header>



      <form
        className="logit-review-form"
        onSubmit={(event) => event.preventDefault()}
      >
        <section className="entity-wizard-card logit-card">
          <header>
            <h2>Address</h2>
            <p>Enter the basic information about the property</p>
          </header>
          <div className="entity-wizard-selected-chip property-entity-chip">
            <span>
              Entity: <strong>{entity?.name || "-"}</strong>
            </span>
            <span>
              Type:{" "}
              <strong>{entity ? titleCase(entity.entityType) : "-"}</strong>
            </span>
          </div>
          <label className="entity-wizard-label">
            <span>
              Property Name <em>*</em>
            </span>
            <input value={property.name} readOnly />
          </label>
          <label className="entity-wizard-label">
            <span>
              Property Location <em>*</em>
            </span>
            <input
              id="locationText"
              className={fieldErrors.locationText ? "has-error" : ""}
              value={locationText}
              onChange={(event) => setLocationText(event.target.value)}
            />
            {fieldErrors.locationText && (
              <span className="logit-field-error">{fieldErrors.locationText}</span>
            )}
          </label>
          <div className="logit-grid">
            <label className="entity-wizard-label">
              <span>
                Address Line 1 <em>*</em>
              </span>
              <input
                id="addressLine1"
                className={fieldErrors.addressLine1 ? "has-error" : ""}
                value={addressLine1}
                onChange={(event) => setAddressLine1(event.target.value)}
              />
              {fieldErrors.addressLine1 && (
                <span className="logit-field-error">{fieldErrors.addressLine1}</span>
              )}
            </label>
            <label className="entity-wizard-label">
              Address Line 2
              <input
                placeholder="Apartment, suite, etc. (optional)"
                value={addressLine2}
                onChange={(event) => setAddressLine2(event.target.value)}
              />
            </label>
          </div>
          <div className="logit-grid-3">
            <label className="entity-wizard-label">
              <span>
                Locality <em>*</em>
              </span>
              <input
                id="locality"
                className={fieldErrors.locality ? "has-error" : ""}
                value={locality}
                onChange={(event) => setLocality(event.target.value)}
              />
              {fieldErrors.locality && (
                <span className="logit-field-error">{fieldErrors.locality}</span>
              )}
            </label>
            <label className="entity-wizard-label">
              <span>
                State <em>*</em>
              </span>
              <input
                id="stateValue"
                className={fieldErrors.stateValue ? "has-error" : ""}
                value={stateValue}
                onChange={(event) => setStateValue(event.target.value)}
              />
              {fieldErrors.stateValue && (
                <span className="logit-field-error">{fieldErrors.stateValue}</span>
              )}
            </label>
            <label className="entity-wizard-label">
              <span>
                Postcode <em>*</em>
              </span>
              <input
                id="postcode"
                className={fieldErrors.postcode ? "has-error" : ""}
                value={postcode}
                onChange={(event) => setPostcode(event.target.value)}
              />
              {fieldErrors.postcode && (
                <span className="logit-field-error">{fieldErrors.postcode}</span>
              )}
            </label>
          </div>
        </section>

        <section className="entity-wizard-card logit-card">
          <header>
            <h2>Acquisition & Disposal Details</h2>
            <p>Details about property purchase and sale</p>
          </header>
          <div className="logit-grid">
            <label className="entity-wizard-label">
              Acquisition Date
              <input
                type="date"
                className="property-date-input"
                value={acquisitionDate}
                onChange={(event) => setAcquisitionDate(event.target.value)}
              />
            </label>
            <label className="entity-wizard-label">
              Acquisition Cost
              <input
                type="number"
                min="0"
                placeholder={CURRENCY_SYMBOL.trim()}
                value={acquisitionCost}
                onChange={(event) => setAcquisitionCost(event.target.value)}
                onFocus={(event) => {
                  const val = event.target.value;
                  if (val === "0" || val === "0.00" || val === "0.0") {
                    setAcquisitionCost("");
                  }
                }}
                onBlur={(event) => {
                  const parsed = Number.parseFloat(event.target.value);
                  if (Number.isFinite(parsed)) {
                    setAcquisitionCost(parsed.toFixed(2));
                  }
                }}
              />
            </label>
            <label className="entity-wizard-label">
              Disposal Date
              <input
                type="date"
                className="property-date-input"
                value={disposalDate}
                onChange={(event) => setDisposalDate(event.target.value)}
              />
            </label>
            <label className="entity-wizard-label">
              Disposal Proceeds
              <input
                type="number"
                min="0"
                placeholder={CURRENCY_SYMBOL.trim()}
                value={disposalProceeds}
                onChange={(event) => setDisposalProceeds(event.target.value)}
                onFocus={(event) => {
                  const val = event.target.value;
                  if (val === "0" || val === "0.00" || val === "0.0") {
                    setDisposalProceeds("");
                  }
                }}
                onBlur={(event) => {
                  const parsed = Number.parseFloat(event.target.value);
                  if (Number.isFinite(parsed)) {
                    setDisposalProceeds(parsed.toFixed(2));
                  }
                }}
              />
            </label>
          </div>
        </section>

        <section className="entity-wizard-card logit-card">
          <header>
            <h2>Rental Period Details</h2>
            <p>Information about rental activity</p>
          </header>
          <label className="entity-wizard-label">
            Date first earned rent
            <input
              type="date"
              className="property-date-input"
              value={dateFirstEarnedRent}
              onChange={(event) => setDateFirstEarnedRent(event.target.value)}
            />
          </label>
          <div className="logit-grid">
            <label className="entity-wizard-label">
              Weeks rented during year
              <input
                id="weeksRented"
                className={fieldErrors.weeksRented ? "has-error" : ""}
                type="number"
                min="0"
                max="52"
                value={weeksRented}
                onChange={(event) => {
                  const val = event.target.value;
                  if (val === "") {
                    setWeeksRented("");
                    return;
                  }
                  const num = Number(val);
                  if (!Number.isNaN(num)) {
                    if (num > 52) {
                      setWeeksRented("52");
                    } else if (num < 0) {
                      setWeeksRented("0");
                    } else {
                      setWeeksRented(val);
                    }
                  }
                }}
              />
              {fieldErrors.weeksRented && (
                <span className="logit-field-error">{fieldErrors.weeksRented}</span>
              )}
            </label>
            <label className="entity-wizard-label">
              Weeks available for rent
              <input
                id="weeksAvailable"
                className={fieldErrors.weeksAvailable ? "has-error" : ""}
                type="number"
                min="0"
                max="52"
                value={weeksAvailable}
                onChange={(event) => {
                  const val = event.target.value;
                  if (val === "") {
                    setWeeksAvailable("");
                    return;
                  }
                  const num = Number(val);
                  if (!Number.isNaN(num)) {
                    if (num > 52) {
                      setWeeksAvailable("52");
                    } else if (num < 0) {
                      setWeeksAvailable("0");
                    } else {
                      setWeeksAvailable(val);
                    }
                  }
                }}
              />
              {fieldErrors.weeksAvailable && (
                <span className="logit-field-error">{fieldErrors.weeksAvailable}</span>
              )}
            </label>
          </div>
          <label className="entity-wizard-label">
            Date available for rent
            <input
              type="date"
              className="property-date-input"
              value={dateAvailable}
              onChange={(event) => setDateAvailable(event.target.value)}
            />
          </label>
        </section>

        <section className="entity-wizard-card logit-card">
          <header>
            <h2>Loan Details</h2>
            <p>Loan negotiation information</p>
          </header>
          <fieldset className="property-wizard-radio logit-radio">
            <legend>Has a loan</legend>
            <label>
              <input
                type="radio"
                checked={hasLoan}
                onChange={() => setHasLoan(true)}
              />
              Yes
            </label>
            <label>
              <input
                type="radio"
                checked={!hasLoan}
                onChange={() => setHasLoan(false)}
              />
              No
            </label>
          </fieldset>
          {hasLoan && (
            <div className="logit-grid">
              <label className="entity-wizard-label">
                Bank name
                <input defaultValue={getLoanDetail(property, "bank_name")} />
              </label>
              <label className="entity-wizard-label">
                Loan amount
                <input
                  type="number"
                  min="0"
                  placeholder={CURRENCY_SYMBOL.trim()}
                  defaultValue={getLoanDetail(property, "loan_amount")}
                  onChange={(event) => {
                    const val = event.target.value;
                    if (val === "") return;
                    const num = Number(val);
                    if (!Number.isNaN(num)) {
                      if (num < 0) {
                        event.target.value = "0";
                      }
                    }
                  }}
                />
              </label>
            </div>
          )}
        </section>

        <section id="owners" className="entity-wizard-card logit-card">
          <header>
            <h2>Ownership Details</h2>
            <p>Define ownership structure</p>
          </header>
          <div className="logit-owner-list">
            {owners.map((owner) => (
              <div key={owner.id} className="logit-owner-row" style={{ alignItems: "flex-start" }}>
                <label className="entity-wizard-label">
                  <span>
                    Owner name <em>*</em>
                  </span>
                  <input
                    id={`owner_name_${owner.id}`}
                    placeholder="Enter owner name"
                    className={(fieldErrors.owners || fieldErrors[`owner_name_${owner.id}`]) ? "has-error" : ""}
                    value={owner.name}
                    onChange={(event) => {
                      const val = event.target.value;
                      updateOwner(owner.id, "name", val);

                      if (nameValidationTimeouts.current[owner.id]) {
                        clearTimeout(nameValidationTimeouts.current[owner.id]);
                      }

                      setFieldErrors((prev) => {
                        const updated = { ...prev };
                        delete updated[`owner_name_${owner.id}`];
                        delete updated.owners;
                        return updated;
                      });

                      nameValidationTimeouts.current[owner.id] = setTimeout(() => {
                        const errorMsg = getOwnerNameError(val);
                        if (errorMsg) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            [`owner_name_${owner.id}`]: errorMsg,
                          }));
                        }
                      }, 500);
                    }}
                  />
                  {fieldErrors[`owner_name_${owner.id}`] && (
                    <span className="logit-field-error">{fieldErrors[`owner_name_${owner.id}`]}</span>
                  )}
                </label>
                <label className="entity-wizard-label">
                  <span>
                    Ownership percentage <em>*</em>
                  </span>
                  <input
                    id={`owner_percentage_${owner.id}`}
                    type="number"
                    min="0"
                    max="100"
                    placeholder="%"
                    className={(fieldErrors.owners || fieldErrors[`owner_percentage_${owner.id}`]) ? "has-error" : ""}
                    value={owner.percentage}
                    onChange={(event) => {
                      updateOwner(owner.id, "percentage", event.target.value);
                      if (fieldErrors[`owner_percentage_${owner.id}`] || fieldErrors.owners) {
                        setFieldErrors((prev) => {
                          const updated = { ...prev };
                          delete updated[`owner_percentage_${owner.id}`];
                          delete updated.owners;
                          return updated;
                        });
                      }
                    }}
                  />
                  {fieldErrors[`owner_percentage_${owner.id}`] && (
                    <span className="logit-field-error">{fieldErrors[`owner_percentage_${owner.id}`]}</span>
                  )}
                </label>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="entity-beneficiary-add"
            onClick={addOwner}
          >
            + Add Owner
          </button>
          {fieldErrors.owners && (
            <span className="logit-field-error">{fieldErrors.owners}</span>
          )}
        </section>

        <LogitTable
          title="Rented Income Section"
          subtitle="Record all rental income received"
          label="Income Type"
          rows={rentedIncome}
          totalLabel="Total Income"
          totalAmount={totals.incomeAmount}
          totalUse={totals.incomeUse}
          onChange={(id, key, value) => updateLine("income", id, key, value)}
          expandedRows={expandedRows}
          onToggleExpand={onToggleExpand}
          onSubcategoryChange={updateSubcategoryLine}
          group="income"
        />
        <LogitTable
          title="Rented Expense Categories"
          subtitle="Track all rental property expenses"
          label="Expense Type"
          rows={rentedExpenses}
          totalLabel="Total Rental Expenses"
          totalAmount={totals.rentalExpenseAmount}
          totalUse={totals.rentalExpenseUse}
          onChange={(id, key, value) => updateLine("expenses", id, key, value)}
          expandedRows={expandedRows}
          onToggleExpand={onToggleExpand}
          onSubcategoryChange={updateSubcategoryLine}
          group="expenses"
        />

        <LogitTable
          title="Borrowing & Finances"
          subtitle="Loan interest and borrowing costs"
          label="Finance Type"
          rows={borrowings}
          totalLabel="Total Borrowing Expenses"
          totalAmount={totals.borrowingAmount}
          totalUse={totals.borrowingUse}
          onChange={(id, key, value) =>
            updateLine("borrowings", id, key, value)
          }
          expandedRows={expandedRows}
          onToggleExpand={onToggleExpand}
          onSubcategoryChange={updateSubcategoryLine}
          group="borrowings"
        />

        <LogitTable
          title="Depreciation"
          subtitle="Capital allowances and works deductions"
          label="Depreciation Type"
          rows={depreciation}
          totalLabel="Total Depreciation Expenses"
          totalAmount={totals.depreciationAmount}
          totalUse={totals.depreciationUse}
          onChange={(id, key, value) =>
            updateLine("depreciation", id, key, value)
          }
          expandedRows={expandedRows}
          onToggleExpand={onToggleExpand}
          onSubcategoryChange={updateSubcategoryLine}
          group="depreciation"
        />
        <div className="logit-grand-total">
          <strong>Total Expenses</strong>
          <span>{formatMoney(totals.expenseAmount)}</span>
          <span>{formatMoney(totals.expenseUse)}</span>
        </div>
        {loadError && <p className="logit-alert is-error">{loadError}</p>}
        {formError && <p className="logit-alert is-error">{formError}</p>}
        {successMessage && (
          <p className="logit-alert is-success">{successMessage}</p>
        )}

        <div className="logit-form-actions">
          <Link href={backHref} className="entity-wizard-secondary">
            Cancel
          </Link>
          <button
            type="button"
            className="entity-wizard-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Lodging..." : "Lodge and Export"}
          </button>
        </div>
      </form>
    </section>
  );
}

function LogitTable({
  title,
  subtitle,
  label,
  rows,
  totalLabel,
  totalAmount,
  totalUse,
  onChange,
  expandedRows,
  onToggleExpand,
  onSubcategoryChange,
  group,
}: {
  title: string;
  subtitle: string;
  label: string;
  rows: ReviewLine[];
  totalLabel: string;
  totalAmount: number;
  totalUse: number;
  onChange: (id: string, key: "amount" | "use", value: string) => void;
  expandedRows: Record<string, boolean>;
  onToggleExpand: (rowId: string) => void;
  onSubcategoryChange: (
    group: "income" | "expenses" | "borrowings" | "depreciation",
    parentId: string,
    subId: string,
    key: "label" | "amount" | "use" | "subcategoryId",
    value: string | number
  ) => void;
  group: "income" | "expenses" | "borrowings" | "depreciation";
}) {
  return (
    <section className="entity-wizard-card logit-card">
      <header>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>
      <div className="logit-table" role="table">
        <div className="logit-table-head" role="row">
          <span>{label}</span>
          <span>Amount</span>
          <span>Use (%)</span>
        </div>
        {rows.map((row) => {
          const hasSubs = !!(row.subcategories && row.subcategories.length > 0);
          const isExpanded = !!expandedRows[row.id];

          return (
            <div key={row.id} className="logit-row-group">
              <div className="logit-table-row" role="row">
                <span>
                  {row.expandable && (
                    <button
                      type="button"
                      className={`logit-expand-btn ${isExpanded ? "is-expanded" : ""}`}
                      onClick={() => onToggleExpand(row.id)}
                      aria-label={isExpanded ? "Collapse subcategories" : "Expand subcategories"}
                    >
                      {isExpanded ? "−" : "+"}
                    </button>
                  )}
                  {row.label}
                </span>
                <input
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={row.amount ?? ""}
                  readOnly={row.expandable || hasSubs}
                  className={(row.expandable || hasSubs) ? "logit-parent-input-readonly" : ""}
                  onChange={(event) =>
                    onChange(row.id, "amount", event.target.value)
                  }
                  onFocus={(event) => {
                    const val = event.target.value;
                    if (val === "0" || val === "0.00" || val === "0.0") {
                      onChange(row.id, "amount", "");
                    }
                  }}
                  onBlur={(event) => {
                    const parsed = Number.parseFloat(event.target.value);
                    const formatted = Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
                    onChange(row.id, "amount", formatted);
                  }}
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0.00"
                  value={row.use ?? ""}
                  readOnly={row.expandable || hasSubs}
                  className={(row.expandable || hasSubs) ? "logit-parent-input-readonly" : ""}
                  onChange={(event) =>
                    onChange(row.id, "use", event.target.value)
                  }
                  onFocus={(event) => {
                    const val = event.target.value;
                    if (val === "0" || val === "0.00" || val === "0.0") {
                      onChange(row.id, "use", "");
                    }
                  }}
                  onBlur={(event) => {
                    const parsed = Number.parseFloat(event.target.value);
                    const formatted = Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
                    onChange(row.id, "use", formatted);
                  }}
                />
              </div>

              {row.expandable && isExpanded && (
                <div className="logit-subcategories-container">
                  {(row.subcategories ?? []).map((sub) => {
                    return (
                      <div className="logit-subcategory-row" key={sub.id} role="row">
                        <span className="logit-subcategory-label">{sub.label}</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0.00"
                          value={sub.amount ?? ""}
                          onChange={(event) =>
                            onSubcategoryChange(
                              group,
                              row.id,
                              sub.id,
                              "amount",
                              event.target.value
                            )
                          }
                          onFocus={(event) => {
                            const val = event.target.value;
                            if (val === "0" || val === "0.00" || val === "0.0") {
                              onSubcategoryChange(
                                group,
                                row.id,
                                sub.id,
                                "amount",
                                ""
                              );
                            }
                          }}
                          onBlur={(event) => {
                            const parsed = Number.parseFloat(event.target.value);
                            const formatted = Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
                            onSubcategoryChange(
                              group,
                              row.id,
                              sub.id,
                              "amount",
                              formatted
                            );
                          }}
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="0.00"
                          value={sub.use ?? ""}
                          onChange={(event) =>
                            onSubcategoryChange(
                              group,
                              row.id,
                              sub.id,
                              "use",
                              event.target.value
                            )
                          }
                          onFocus={(event) => {
                            const val = event.target.value;
                            if (val === "0" || val === "0.00" || val === "0.0") {
                              onSubcategoryChange(
                                group,
                                row.id,
                                sub.id,
                                "use",
                                ""
                              );
                            }
                          }}
                          onBlur={(event) => {
                            const parsed = Number.parseFloat(event.target.value);
                            const formatted = Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
                            onSubcategoryChange(
                              group,
                              row.id,
                              sub.id,
                              "use",
                              formatted
                            );
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        <div className="logit-table-total" role="row">
          <strong>{totalLabel}</strong>
          <span>{formatMoney(totalAmount)}</span>
          <span>{formatMoney(totalUse)}</span>
        </div>
      </div>
    </section>
  );
}
