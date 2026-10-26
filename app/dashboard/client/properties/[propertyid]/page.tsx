"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "boneyard-js/react";
import { PropertyDetailSkeleton } from "@/app/components/PortalSkeletons";
import { getSession } from "@/src/lib/session";
import { getIdToken } from "@/src/lib/authToken";
import { formatClientCurrency, formatExactCurrency } from "@/app/components/clients/CurrencyFormatter";
import type { CoreProperty, CoreEntity, CorePropertyTransactionRow } from "@/src/lib/coreApi";
import PropertyTrendChart, { type PropertyTrendRow } from "@/app/components/clients/PropertyTrendChart";
import ClientGstSummaryCard from "@/app/components/clients/ClientGstSummaryCard";
import ClientPersonalTransactionsCard from "@/app/components/clients/ClientPersonalTransactionsCard";
import ClientAssetsCard from "@/app/components/clients/ClientAssetsCard";
import RegionError from "@/app/components/ui/RegionError";
import { usePortfolioSummary } from "@/app/components/usePortfolioSummary";
import { fetchCurrentUser } from "@/app/components/currentUser";
import {
  currentFinancialYear,
  monthAt,
  monthIndex,
  monthKey,
  monthShortLabel,
  shiftMonth,
} from "@/app/components/clients/portfolioDashboard";
import { clientReportsHubHref } from "@/app/components/reports/client/reportLinks";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

type DocumentListItem = {
  id: string;
  file_name: string;
  original_file_name: string;
  document_type: string;

  processing_status: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  source: "transaction" | "reconciliation" | "direct";
};

type UploadingFile = {
  id: string;
  name: string;
  progress: number;
};

// Title casing utility
function titleCase(value: string) {
  if (!value) return "";
  return value
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

// Bank name expander
function formatBankName(bank: any) {
  if (!bank) return "—";
  const str = String(bank).trim().toUpperCase();
  if (str === "CBA") return "Commonwealth Bank";
  if (str === "NAB") return "National Australia Bank";
  if (str === "ANZ") return "ANZ Bank";
  if (str === "WBC" || str === "WESTPAC") return "Westpac";
  return String(bank);
}

// BSB Formatter
function formatBsb(bsb: any) {
  if (!bsb) return "—";
  const str = String(bsb).replace(/\D/g, "");
  if (str.length === 6) {
    return `${str.slice(0, 3)}-${str.slice(3)}`;
  }
  return String(bsb);
}

// Loan Account Masker
function formatLoanAccount(account: any) {
  if (!account) return "—";
  const str = String(account).trim();
  if (str.length > 4) {
    return `...${str.slice(-4)}`;
  }
  return str;
}

// Date formatters
function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDocDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Currency formatter using the standard formatExactCurrency for exact 2-decimal display
function formatCurrency(val: number, showPlus = false) {
  return formatExactCurrency(val, { showPlus });
}

// A figure that may not have loaded: "—" rather than a confident A$ 0.
function formatFigure(val: number | null | undefined, showPlus = false) {
  if (val == null || !Number.isFinite(val)) return "—";
  return formatCurrency(val, showPlus);
}

// Hero colour for a signed figure; white while it is still "—".
function figureTone(val: number | null) {
  if (val == null) return "text-white";
  return val >= 0 ? "text-[#4ade80]" : "text-[#fb923c]";
}

// The loan inside property.loan_details. That JSONB also holds unrelated keys
// (property_status_details, depreciation_schedule_*), so "has a loan" means one
// of these is set, not that the object exists. The first key of each list is
// what the add-property form writes; the rest are older spellings, read in the
// order the Go report reads them (portfolio_loan.go).
const LOAN_KEYS = {
  bank: ["bank_name", "bankName"],
  bsb: ["bsb_number", "bsbNumber"],
  account: ["loan_account_number", "loanAccountNumber"],
  amount: ["loan_amount", "loanAmount", "amount"],
  allocation: ["loan_allocation_percentage", "loanAllocationPercentage"],
} as const;

type RecordedLoan = {
  bankName: string;
  bsbNumber: string;
  accountNumber: string;
  amount: number | null;
  /** Share of the loan on this property, when it is not the whole loan. */
  allocationPercent: number | null;
};

function loanValue(details: Record<string, unknown> | null, keys: readonly string[]): unknown {
  for (const key of keys) {
    const value = details?.[key];
    if (value != null && !(typeof value === "string" && value.trim() === "")) return value;
  }
  return undefined;
}

function loanNumber(value: unknown): number | null {
  if (value === undefined) return null;
  const n =
    typeof value === "number" ? value : Number.parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function readLoan(details: Record<string, unknown> | null): RecordedLoan | null {
  const bank = loanValue(details, LOAN_KEYS.bank);
  const bsb = loanValue(details, LOAN_KEYS.bsb);
  const account = loanValue(details, LOAN_KEYS.account);
  const amount = loanValue(details, LOAN_KEYS.amount);
  if (bank === undefined && bsb === undefined && account === undefined && amount === undefined) {
    return null;
  }
  const allocation = loanNumber(loanValue(details, LOAN_KEYS.allocation));
  return {
    bankName: bank === undefined ? "" : String(bank),
    bsbNumber: bsb === undefined ? "" : String(bsb),
    accountNumber: account === undefined ? "" : String(account),
    amount: loanNumber(amount),
    allocationPercent: allocation != null && allocation > 0 && allocation < 100 ? allocation : null,
  };
}

/**
 * loan_details with the loan fields replaced (or, with null, removed) and every
 * other key kept. A value goes to the canonical key, and to an older spelling
 * only where the record already has one — so no reader is left on a stale
 * alias, and none is invented.
 */
function withLoan(
  details: Record<string, unknown> | null,
  loan: { bankName: string; bsbNumber: string; accountNumber: string; amount: number | null } | null,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(details ?? {}) };
  const put = (keys: readonly string[], value: string | number | null) => {
    keys.forEach((key, i) => {
      if (i > 0 && !(key in next)) return;
      if (value === null || value === "") delete next[key];
      else next[key] = value;
    });
  };
  if (!loan) {
    for (const keys of Object.values(LOAN_KEYS)) put(keys, null);
    return next;
  }
  put(LOAN_KEYS.bank, loan.bankName.trim());
  put(LOAN_KEYS.bsb, loan.bsbNumber.replace(/\D/g, ""));
  put(LOAN_KEYS.account, loan.accountNumber.trim());
  put(LOAN_KEYS.amount, loan.amount);
  return next;
}

export default function ClientPropertyDetailPage() {
  const params = useParams<{ propertyid: string }>();
  const router = useRouter();
  const propertyId = params?.propertyid ?? "";

  const [isMobile, setIsMobile] = useState(false);
  // Reports for this property: the report list with it preselected — the
  // sidebar's Reports page on desktop, Insights → Reports on a phone.
  const reportsHref = clientReportsHubHref({ propertyId }, { mobile: isMobile });
  const [isLoading, setIsLoading] = useState(true);
  const [property, setProperty] = useState<CoreProperty | null>(null);
  const [entity, setEntity] = useState<CoreEntity | null>(null);
  const [transactions, setTransactions] = useState<CorePropertyTransactionRow[]>([]);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [sessionToken, setSessionToken] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Loan Details modal. It saves to the property's loan_details, so the Loan
  // Summary, the hero's Loan Balance and its Net Position all move together.
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [formBankName, setFormBankName] = useState("");
  const [formBsbNumber, setFormBsbNumber] = useState("");
  const [formAccountNumber, setFormAccountNumber] = useState("");
  const [formLoanAmount, setFormLoanAmount] = useState("");
  const [loanSaving, setLoanSaving] = useState(false);
  const [loanError, setLoanError] = useState<string | null>(null);

  const loan = useMemo(() => readLoan(property?.loanDetails ?? null), [property]);

  // ---------------------------------------------------------------------------
  // Money: the Portfolio Summary narrowed to this property, as the entity page
  // does for an entity — the same aggregate as the Properties list and the
  // Reports page (gross, this property's share of a split bill, unreviewed and
  // rejected rows excluded). Cash Flow used to be summed in the browser from
  // one page of transactions, rejected rows included; Net Position took the
  // whole loan even when only part of it sits on this property.
  // ---------------------------------------------------------------------------
  const financialYear = currentFinancialYear();
  const summaryRegion = usePortfolioSummary(clientId, financialYear, null, propertyId);
  // The six-month trend crosses 1 July for half the year.
  const lastYearRegion = usePortfolioSummary(clientId, financialYear - 1, null, propertyId);
  const summary = summaryRegion.data;
  const totals = summary?.totals ?? null;

  const handleBsbChange = (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 6);
    if (clean.length > 3) {
      return `${clean.slice(0, 3)}-${clean.slice(3)}`;
    }
    return clean;
  };

  const openLoanModal = () => {
    setFormBankName(loan?.bankName ?? "");
    setFormBsbNumber(loan?.bsbNumber ? formatBsb(loan.bsbNumber) : "");
    setFormAccountNumber(loan?.accountNumber ?? "");
    setFormLoanAmount(loan?.amount != null ? String(loan.amount) : "");
    setLoanError(null);
    setIsLoanModalOpen(true);
  };

  // PATCHes the whole loan_details object (the API replaces it), built from
  // the stored one so the keys this modal does not edit survive.
  const saveLoanDetails = async (nextLoan: Parameters<typeof withLoan>[1]) => {
    if (!property) return;
    setLoanSaving(true);
    setLoanError(null);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/properties/${encodeURIComponent(property.id)}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ loan_details: withLoan(property.loanDetails, nextLoan) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || body?.error || `Couldn't save the loan (${res.status}).`);
      }
      setProperty((await res.json()) as CoreProperty);
      setIsLoanModalOpen(false);
      // Loan Balance and Net Position are the server's, so ask it again.
      summaryRegion.reload();
    } catch (err) {
      setLoanError(err instanceof Error ? err.message : "Couldn't save the loan.");
    } finally {
      setLoanSaving(false);
    }
  };

  const handleSaveLoanDetails = () => {
    const amountText = formLoanAmount.trim();
    const amount = amountText === "" ? null : Number.parseFloat(amountText);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      setLoanError("Enter the loan amount as a number, or leave it blank.");
      return;
    }
    void saveLoanDetails({
      bankName: formBankName,
      bsbNumber: formBsbNumber,
      accountNumber: formAccountNumber,
      amount,
    });
  };

  const handleClearLoanDetails = () => {
    if (!window.confirm("Remove this property's loan details?")) return;
    void saveLoanDetails(null);
  };

  // Detect mobile width dynamically
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch all property details, transactions, documents, and related entity
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) {
          router.replace("/login/user");
          return;
        }
        const token = session.getIdToken().getJwtToken();
        if (!cancelled) setSessionToken(token);

        // The client id the Portfolio Summary is read under. Shares the
        // layout's in-flight /api/users/me; on failure the hero stays "—".
        fetchCurrentUser(token)
          .then((me) => {
            if (!cancelled) setClientId(me.id || null);
          })
          .catch((err) => console.error("Failed to load the current user:", err));

        // Fetch property details, transactions, and documents in parallel
        const [propertyRes, transactionsRes, documentsRes] = await Promise.all([
          fetch(`/api/properties/${encodeURIComponent(propertyId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/properties/${encodeURIComponent(propertyId)}/transactions`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/documents/list?property_id=${encodeURIComponent(propertyId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (cancelled) return;

        let loadedProperty: CoreProperty | null = null;
        if (propertyRes.ok) {
          loadedProperty = (await propertyRes.json()) as CoreProperty;
          if (!cancelled) setProperty(loadedProperty);
        }

        if (transactionsRes.ok) {
          const data = (await transactionsRes.json()) as { items?: CorePropertyTransactionRow[] };
          if (!cancelled) setTransactions(data.items || []);
        }

        if (documentsRes.ok) {
          const data = (await documentsRes.json()) as { items?: DocumentListItem[] };
          if (!cancelled) setDocuments(data.items || []);
        }

        // Fetch related entity if property was loaded successfully
        if (loadedProperty && loadedProperty.entityId) {
          const entityRes = await fetch(`/api/entities/${encodeURIComponent(loadedProperty.entityId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!cancelled && entityRes.ok) {
            const loadedEntity = (await entityRes.json()) as CoreEntity;
            setEntity(loadedEntity);
          }
        }
      } catch (err) {
        console.error("Failed to load property details:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (propertyId) {
      loadData();
    }
    return () => {
      cancelled = true;
    };
  }, [propertyId, router]);

  // Derived Values — all from the summary, "—" until it lands.
  // Loan Balance is this property's share of its loan (amount × allocation),
  // and Net Position is market value less that share: the server's
  // net_equity, so it matches the Properties list and the Reports page.
  const loanBalance = totals ? totals.loanBalance : null;
  const netPosition = totals ? totals.netEquity : null;

  const monthsByKey = monthIndex(lastYearRegion.data, summary);
  const now = new Date();
  const thisMonth = monthAt(monthsByKey, monthKey(now));
  const cashFlowThisMonth = summary ? thisMonth.income - thisMonth.expenses : null;

  // Last 6 months, ending this month. Waits for both years so the months
  // before 1 July don't flash as zeros while last year's summary loads.
  const trendRows: PropertyTrendRow[] | null =
    summary && lastYearRegion.data
      ? [5, 4, 3, 2, 1, 0].map((back) => {
          const key = monthKey(shiftMonth(now, -back));
          const month = monthAt(monthsByKey, key);
          return { key, label: monthShortLabel(key), income: month.income, expense: month.expenses };
        })
      : null;

  const figuresError =
    summaryRegion.status === "error" || lastYearRegion.status === "error"
      ? summaryRegion.error ?? lastYearRegion.error ?? ""
      : null;
  const retryFigures = () => {
    summaryRegion.reload();
    lastYearRegion.reload();
  };

  // Recent transactions (top 3)
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())
      .slice(0, 3);
  }, [transactions]);

  // Document action triggers
  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";

    for (const file of files) {
      const tempId = Math.random().toString(36).substring(7);
      setUploadingFiles((prev) => [...prev, { id: tempId, name: file.name, progress: 0 }]);

      try {
        const presignParams = new URLSearchParams({
          filename: file.name,
          document_type: "direct",
          property_id: propertyId,
        });
        if (property?.entityId) {
          presignParams.set("entity_id", property.entityId);
        }

        const presignRes = await fetch(`/api/documents/presign?${presignParams.toString()}`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (!presignRes.ok) throw new Error("Presign failed");

        const { upload_url } = (await presignRes.json()) as { upload_url: string };

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", upload_url);
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentage = Math.round((event.loaded / event.total) * 100);
              setUploadingFiles((prev) =>
                prev.map((f) => (f.id === tempId ? { ...f, progress: percentage } : f))
              );
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error("S3 Upload failed"));
            }
          };
          xhr.onerror = () => reject(new Error("Network upload error"));
          xhr.send(file);
        });

        setTimeout(async () => {
          setUploadingFiles((prev) => prev.filter((f) => f.id !== tempId));
          // Refetch documents
          const docRes = await fetch(`/api/documents/list?property_id=${encodeURIComponent(propertyId)}`, {
            headers: { Authorization: `Bearer ${sessionToken}` },
          });
          if (docRes.ok) {
            const data = (await docRes.json()) as { items?: DocumentListItem[] };
            setDocuments(data.items || []);
          }
        }, 600);
      } catch (err) {
        console.error("Direct upload failed:", err);
        alert(`Failed to upload ${file.name}. Please try again.`);
        setUploadingFiles((prev) => prev.filter((f) => f.id !== tempId));
      }
    }
  };

  const handleDownload = async (id: string, fileName: string) => {
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(id)}/download`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) throw new Error("Download failed");
      const data = (await res.json()) as { download_url: string; file_name: string };
      const a = document.createElement("a");
      a.href = data.download_url;
      a.download = data.file_name || fileName;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to download document:", err);
    }
  };

  // Render Mobile Responsive View
  const renderMobileView = () => {
    if (!property) return null;
    return (
      <div className="flex flex-col min-h-screen bg-[#f7f9fc]">
        {/* Mobile Header */}
        <div className="sticky top-0 z-50 flex items-center justify-between px-4 py-3.5 bg-white border-b border-[#eaeef4]">
          {/* Back link */}
          <Link
            href="/dashboard/client/properties"
            className="flex items-center gap-1 text-sm font-semibold text-[#1a235a]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back
          </Link>

          {/* Title */}
          <div className="flex items-center gap-1 text-base font-bold text-[#101828]">Property
            <span>Detail</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Reports, with this property preselected */}
            <Link
              href={reportsHref}
              className="px-4 py-1.5 border border-[#eaeef4] hover:bg-gray-50 rounded-full text-xs font-bold text-[#101828] transition-all cursor-pointer"
            >
              Reports
            </Link>
            {/* Edit button */}
            <Link
              href={`/dashboard/client/properties/${property.id}/edit`}
              className="px-4 py-1.5 border border-[#eaeef4] hover:bg-gray-50 rounded-full text-xs font-bold text-[#101828] transition-all cursor-pointer"
            >
              Edit
            </Link>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 flex flex-col gap-4 pb-28">
          {/* Hero Blue Card */}
          <div
            className="rounded-3xl p-5 text-white flex flex-col gap-5 shadow-lg relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #1b2559 0%, #28336e 100%)",
            }}
          >
            <div className="flex flex-col gap-1.5">
              {/* Badge */}
              <div className="self-start px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/15 text-white uppercase tracking-wider">
                {property.propertyType ? titleCase(property.propertyType) : "Residential"} · {property.status ? titleCase(property.status) : "Rented"}
              </div>
              {/* Title */}
              <h1 className="text-2xl font-bold tracking-tight">{property.name}</h1>
              {/* Subtitle */}
              <p className="text-white/80 text-sm font-medium">{entity?.name || "Individual"}</p>
            </div>

            {/* Metrics 2x2 Grid */}
            <div className="grid grid-cols-2 gap-3.5">
              {/* Market Value */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-1">
                <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider">Market Value</span>
                <span className="text-lg font-extrabold text-white">
                  {formatCurrency(property.estimatedMarketValue)}
                </span>
              </div>
              {/* Net Position */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-1">
                <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider">Net Position</span>
                <span className={`text-lg font-extrabold ${figureTone(netPosition)}`}>
                  {formatFigure(netPosition)}
                </span>
              </div>
              {/* Loan Balance */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-1">
                <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider">Loan Balance</span>
                <span className="text-lg font-extrabold text-[#fb923c]">
                  {formatFigure(loanBalance)}
                </span>
              </div>
              {/* Cash Flow (This Month) */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-1">
                <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider">Cash Flow</span>
                <span className={`text-lg font-extrabold ${figureTone(cashFlowThisMonth)}`}>
                  {formatFigure(cashFlowThisMonth, true)}
                </span>
              </div>
            </div>
          </div>

          {figuresError !== null && (
            <RegionError
              message={`Couldn't load this property's figures. ${figuresError}`.trim()}
              onRetry={retryFigures}
            />
          )}

          {/* Loan Summary Card */}
          <div className="bg-white rounded-2xl border border-[#eaeef4] p-5 flex flex-col gap-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#101828]">Loan Summary</h2>
              {loan && (
                <button
                  onClick={openLoanModal}
                  className="text-xs font-bold text-[#1b2559] hover:underline cursor-pointer"
                >
                  Edit
                </button>
              )}
            </div>
            {loan ? (
              <div className="flex flex-col text-sm">
                <div className="flex justify-between items-center py-2.5 border-b border-[#eaeef4]">
                  <span className="text-[#667085] font-medium">Bank</span>
                  <span className="font-bold text-[#101828]">
                    {formatBankName(loan.bankName)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-[#eaeef4]">
                  <span className="text-[#667085] font-medium">BSB Number</span>
                  <span className="font-bold text-[#101828]">
                    {formatBsb(loan.bsbNumber)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-[#eaeef4]">
                  <span className="text-[#667085] font-medium">Loan Account</span>
                  <span className="font-bold text-[#101828]">
                    {formatLoanAccount(loan.accountNumber)}
                  </span>
                </div>
                <div className={`flex justify-between items-center py-2.5 ${loan.allocationPercent != null ? "border-b border-[#eaeef4]" : ""}`}>
                  <span className="text-[#667085] font-medium">Loan Amount</span>
                  <span className="font-bold text-[#101828]">
                    {formatFigure(loan.amount)}
                  </span>
                </div>
                {loan.allocationPercent != null && (
                  <div className="flex justify-between items-center py-2.5">
                    <span className="text-[#667085] font-medium">On this property</span>
                    <span className="font-bold text-[#101828]">{loan.allocationPercent}%</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center flex flex-col items-center gap-2">
                <p className="text-xs text-[#667085]">No loan details configured for this property.</p>
                <button
                  onClick={openLoanModal}
                  className="px-3.5 py-1.5 bg-[#1b2559] hover:bg-[#151c44] text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  Add Loan
                </button>
              </div>
            )}
          </div>

          {/* Profit & Loss Trend Card */}
          <div className="bg-white rounded-2xl border border-[#eaeef4] p-5 flex flex-col gap-4 shadow-sm">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-base font-bold text-[#101828]">Profit & Loss Trend</h2>
              <p className="text-[10px] text-[#667085] font-medium">Income vs expenses · last 6 months</p>
            </div>
            <PropertyTrendChart rows={trendRows} />
          </div>

          {/* Add Transaction Banner Button */}
          <Link
            href={`/dashboard/client/transactions/new?propertyId=${propertyId}`}
            className="w-full flex items-center justify-center gap-3 py-3.5 font-bold rounded-2xl transition-all shadow-md cursor-pointer text-base"
            style={{
              background: 'linear-gradient(135deg, #ffd36f 0%, #f7a61a 100%)',
              color: '#1b265c',
              boxShadow: '0 4px 15px rgba(247, 166, 26, 0.15)',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ width: '20px', height: '20px', minWidth: '20px', minHeight: '20px' }}
              >
                <path d="m15 4 5 4-5 4" />
                <path d="M20 8H4" />
                <path d="m9 20-5-4 5-4" />
                <path d="M4 16h16" />
              </svg>
            </div>
            <span>Add Transaction</span>
          </Link>

          {/* Recent Transactions Card */}
          <div className="bg-white rounded-2xl border border-[#eaeef4] p-5 flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#101828]">Recent Transactions</h2>
              <Link
                href={`/dashboard/client/transactions?propertyId=${propertyId}`}
                className="text-xs font-bold text-[#1b2559] hover:underline"
              >
                View all
              </Link>
            </div>

            {recentTransactions.length > 0 ? (
              <div className="flex flex-col gap-3.5">
                {recentTransactions.map((tx) => {
                  const isIncome = tx.transactionType === "revenue";
                  const amount = Math.abs(tx.splitGrossAmount || tx.transactionGrossAmount || 0);

                  return (
                    <div key={tx.transactionId} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isIncome ? "bg-[#e8f8f0] text-[#16a34a]" : "bg-[#fdf2f2] text-[#e53e3e]"
                            }`}
                        >
                          {isIncome ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                              <path d="M12 19V5M5 12l7-7 7 7" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                              <path d="M12 5v14M5 12l7 7 7-7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-[#101828] truncate max-w-[140px] sm:max-w-[200px]">
                            {tx.description || tx.subcategoryName || tx.categoryName}
                          </span>
                          <span className="text-[10px] text-[#667085] font-semibold truncate max-w-[140px]">
                            {tx.categoryName}
                          </span>
                        </div>
                      </div>
                      <span className={`text-xs font-extrabold ${isIncome ? "text-[#16a34a]" : "text-[#e53e3e]"}`}>
                        {formatCurrency(isIncome ? amount : -amount, true)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-[#667085]">
                No transactions recorded for this property.
              </div>
            )}
          </div>

          {/* GST Summary: this property's share of each bill, with personal
              spending. Desktop has the same card — keep the two in step. */}
          <ClientGstSummaryCard level="property" id={propertyId} scopeName={property.name} />

          {/* Personal Transactions and Assets: the entity page's two cards at
              property scope, same requests. Asset rows open this property's
              asset page. Desktop has the same pair, so keep the two in step. */}
          <ClientPersonalTransactionsCard level="property" id={propertyId} />

          <ClientAssetsCard
            level="property"
            id={propertyId}
            assetHrefBase={`/dashboard/client/properties/${propertyId}/assets`}
            layout="list"
          />

          {/* Documents Card */}
          <div className="bg-white rounded-2xl border border-[#eaeef4] p-5 flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#101828]">Documents</h2>
              <button
                onClick={triggerFileUpload}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#1b2559] hover:bg-[#151c44] text-white text-[10px] font-bold rounded-lg cursor-pointer"
              >
                Add
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {uploadingFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between py-1.5 border-b border-[#eaeef4] border-dashed">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-[#eaeef4] flex items-center justify-center text-[#7b88ad] animate-pulse">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-[#101828] truncate max-w-[120px]">{file.name}</span>
                      <span className="text-[8px] text-[#667085] font-semibold">Uploading {file.progress}%</span>
                    </div>
                  </div>
                  <div className="w-10 bg-gray-200 rounded-full h-1 overflow-hidden">
                    <div className="bg-[#1b2559] h-full" style={{ width: `${file.progress}%` }} />
                  </div>
                </div>
              ))}

              {documents.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => handleDownload(doc.id, doc.original_file_name)}
                      className="client-doc-row flex items-center justify-between p-2.5 rounded-xl border border-[#eaeef4] hover:bg-[#f8f9fb] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#eaeef4]/60 text-[#1b2559] flex items-center justify-center shrink-0">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-4.5 h-4.5"
                          >
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-[#101828] group-hover:text-[#1b2559] transition-colors truncate max-w-[140px] sm:max-w-[200px]">
                            {doc.original_file_name}
                          </span>
                          <span className="text-[10px] text-[#667085] font-semibold">
                            {formatDocDate(doc.created_at)}
                          </span>
                        </div>
                      </div>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className="w-3.5 h-3.5 text-[#98a2b3] group-hover:text-[#1b2559] transition-colors"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </div>
                  ))}
                </div>
              ) : (
                uploadingFiles.length === 0 && (
                  <div className="py-8 text-center text-xs text-[#667085]">
                    No documents uploaded.
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Desktop & Tablet View
  const renderDesktopView = () => {
    if (!property) return null;
    return (
      <div className="desktop-client-dashboard">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-[#7b88ad] font-medium">
          <Link href="/dashboard/client/properties" className="hover:text-[#1b2559] transition-colors">
            Properties
          </Link>
          <span>/</span>
          <span className="text-[#101828] font-semibold">{property.name}</span>
        </div>

        {/* Hero Blue Card */}
        <div
          className="rounded-3xl p-6 lg:p-8 text-white flex flex-col gap-6 lg:gap-8 shadow-xl relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #1b2559 0%, #28336e 100%)",
          }}
        >
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="flex flex-col gap-2.5">
              {/* Badge pill */}
              <div className="self-start px-3 py-1 rounded-full text-xs font-bold border border-[#f4a117]/30 bg-[#f4a117]/10 text-[#f4a117] tracking-wider uppercase">
                {property.propertyType ? titleCase(property.propertyType) : "Residential"} · {property.status ? titleCase(property.status) : "Rented"}
              </div>
              {/* Title */}
              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">{property.name}</h1>
              {/* Subtitle */}
              <p className="text-white/80 text-base font-medium">{entity?.name || "Individual"}</p>
            </div>

            <div className="self-start flex items-center gap-2">
            {/* Reports, with this property preselected */}
            <Link
              href={reportsHref}
              className="flex items-center gap-2 px-4 py-2 border border-white/20 hover:border-white/50 hover:bg-white/5 rounded-xl transition-all font-semibold text-sm cursor-pointer"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
                aria-hidden="true"
              >
                <path d="M3 3v18h18" />
                <path d="M7 15l4-4 3 3 5-6" />
              </svg>
              Reports
            </Link>
            {/* Edit button */}
            <Link
              href={`/dashboard/client/properties/${property.id}/edit`}
              className="flex items-center gap-2 px-4 py-2 border border-white/20 hover:border-white/50 hover:bg-white/5 rounded-xl transition-all font-semibold text-sm cursor-pointer"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              Edit
            </Link>
            </div>
          </div>

          {/* Metric Cards Overlay */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Market Value */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex flex-col gap-1.5 shadow-sm">
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Market Value</span>
              <span className="text-2xl lg:text-3xl font-bold text-white">
                {formatCurrency(property.estimatedMarketValue)}
              </span>
            </div>

            {/* Net Position */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex flex-col gap-1.5 shadow-sm">
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Net Position</span>
              <span className={`text-2xl lg:text-3xl font-bold ${figureTone(netPosition)}`}>
                {formatFigure(netPosition)}
              </span>
            </div>

            {/* Loan Balance */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex flex-col gap-1.5 shadow-sm">
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Loan Balance</span>
              <span className="text-2xl lg:text-3xl font-bold text-[#fb923c]">
                {formatFigure(loanBalance)}
              </span>
            </div>

            {/* Cash Flow (This Month) */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex flex-col gap-1.5 shadow-sm">
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Cash Flow (This Month)</span>
              <span className={`text-2xl lg:text-3xl font-bold ${figureTone(cashFlowThisMonth)}`}>
                {formatFigure(cashFlowThisMonth, true)}
              </span>
            </div>
          </div>
        </div>

        {figuresError !== null && (
          <RegionError
            message={`Couldn't load this property's figures. ${figuresError}`.trim()}
            onRetry={retryFigures}
          />
        )}

        {/* Add Transaction Banner */}
        <Link
          href={`/dashboard/client/transactions/new?propertyId=${propertyId}`}
          className="w-full flex items-center justify-center gap-2 py-4 bg-[#f4a117] hover:bg-[#e0900f] text-[#1b2559] font-bold rounded-2xl transition-all shadow-md active:scale-[0.99] cursor-pointer"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ width: '18px', height: '18px', minWidth: '18px', minHeight: '18px' }}
          >
            <path d="m16 3 4 4-4 4" />
            <path d="M20 7H4" />
            <path d="m8 21-4-4 4-4" />
            <path d="M4 17h16" />
          </svg>
          Add transaction
        </Link>

        {/* Grid Content Columns (stacked in 1 col on tablet, 2 cols on desktop) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Row 1, Col 1: Loan Summary */}
          <div className="bg-white rounded-3xl border border-[#eaeef4] p-6 flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#101828]">Loan Summary</h2>
              {loan && (
                <button
                  onClick={openLoanModal}
                  className="text-sm font-semibold text-[#1b2559] hover:underline cursor-pointer"
                >
                  Edit
                </button>
              )}
            </div>
            {loan ? (
              <div className="flex flex-col">
                <div className="flex justify-between items-center py-3.5 border-b border-[#eaeef4]">
                  <span className="text-sm text-[#667085] font-medium">Bank</span>
                  <span className="text-sm font-bold text-[#101828]">
                    {formatBankName(loan.bankName)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3.5 border-b border-[#eaeef4]">
                  <span className="text-sm text-[#667085] font-medium">BSB Number</span>
                  <span className="text-sm font-bold text-[#101828]">
                    {formatBsb(loan.bsbNumber)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3.5 border-b border-[#eaeef4]">
                  <span className="text-sm text-[#667085] font-medium">Loan Account</span>
                  <span className="text-sm font-bold text-[#101828]">
                    {formatLoanAccount(loan.accountNumber)}
                  </span>
                </div>
                <div className={`flex justify-between items-center py-3.5 ${loan.allocationPercent != null ? "border-b border-[#eaeef4]" : ""}`}>
                  <span className="text-sm text-[#667085] font-medium">Loan Amount</span>
                  <span className="text-sm font-bold text-[#101828]">
                    {formatFigure(loan.amount)}
                  </span>
                </div>
                {loan.allocationPercent != null && (
                  <div className="flex justify-between items-center py-3.5">
                    <span className="text-sm text-[#667085] font-medium">On this property</span>
                    <span className="text-sm font-bold text-[#101828]">{loan.allocationPercent}%</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center flex flex-col items-center gap-3">
                <p className="text-sm text-[#667085]">No loan details configured for this property.</p>
                <button
                  onClick={openLoanModal}
                  className="px-4 py-2 bg-[#1b2559] hover:bg-[#151c44] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm animate-fade-in"
                >
                  Add Loan Details
                </button>
              </div>
            )}
          </div>

          {/* Row 1, Col 2: Profit & Loss Trend */}
          <div className="bg-white rounded-3xl border border-[#eaeef4] p-6 flex flex-col gap-5 shadow-sm">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-lg font-bold text-[#101828]">Profit & Loss Trend</h2>
              <p className="text-xs text-[#667085] font-medium">Income vs expenses · last 6 months</p>
            </div>
            <PropertyTrendChart rows={trendRows} />
          </div>

          {/* Row 2, Col 1: Recent Transactions */}
          <div className="bg-white rounded-3xl border border-[#eaeef4] p-6 flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#101828]">Recent Transactions</h2>
              <Link
                href={`/dashboard/client/transactions?propertyId=${propertyId}`}
                className="text-sm font-semibold text-[#1b2559] hover:underline"
              >
                View all
              </Link>
            </div>

            {recentTransactions.length > 0 ? (
              <div className="flex flex-col gap-4">
                {recentTransactions.map((tx) => {
                  const isIncome = tx.transactionType === "revenue";
                  const amount = Math.abs(tx.splitGrossAmount || tx.transactionGrossAmount || 0);

                  return (
                    <div key={tx.transactionId} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-3">
                        {/* Transaction Icon */}
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isIncome ? "bg-[#e8f8f0] text-[#16a34a]" : "bg-[#fdf2f2] text-[#e53e3e]"
                            }`}
                        >
                          {isIncome ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                              <path d="M12 19V5M5 12l7-7 7 7" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                              <path d="M12 5v14M5 12l7 7 7-7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-[#101828] truncate max-w-[200px] sm:max-w-[280px]">
                            {tx.description || tx.subcategoryName || tx.categoryName}
                          </span>
                          <span className="text-xs text-[#667085] font-semibold">
                            {tx.categoryName} {tx.subcategoryName ? `· ${tx.subcategoryName}` : ""}
                          </span>
                        </div>
                      </div>
                      <span className={`text-sm font-extrabold ${isIncome ? "text-[#16a34a]" : "text-[#e53e3e]"}`}>
                        {formatCurrency(isIncome ? amount : -amount, true)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-[#667085]">
                No transactions recorded for this property.
              </div>
            )}
          </div>

          {/* Row 2, Col 2: GST Summary — this property's share of each bill,
              with personal spending. The mobile view has the same card. */}
          <ClientGstSummaryCard level="property" id={propertyId} scopeName={property.name} />

          {/* Row 3: Personal Transactions | Assets, the entity page's two
              cards at property scope, same requests. The mobile view has the
              same pair. */}
          <ClientPersonalTransactionsCard level="property" id={propertyId} />
          <div className="min-w-0">
            <ClientAssetsCard
              level="property"
              id={propertyId}
              assetHrefBase={`/dashboard/client/properties/${propertyId}/assets`}
              className="bg-[var(--surface-1)] rounded-2xl border border-[var(--border)] p-5 shadow-sm h-full"
            />
          </div>

          {/* Row 4: Documents, full width (as on the entity page) */}
          <div className="xl:col-span-2 bg-white rounded-3xl border border-[#eaeef4] p-6 flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#101828]">Documents</h2>
              <button
                onClick={triggerFileUpload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1b2559] hover:bg-[#151c44] text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                + Add
              </button>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleUploadFile}
                className="hidden"
                multiple
              />
            </div>

            <div className="flex flex-col gap-4">
              {uploadingFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between py-2 border-b border-[#eaeef4] border-dashed">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-[#eaeef4] flex items-center justify-center text-[#7b88ad] animate-pulse">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-[#101828] truncate max-w-[200px]">{file.name}</span>
                      <span className="text-[10px] text-[#667085] font-semibold">Uploading {file.progress}%</span>
                    </div>
                  </div>
                  <div className="w-12 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-[#1b2559] h-full transition-all duration-300" style={{ width: `${file.progress}%` }} />
                  </div>
                </div>
              ))}

              {documents.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => handleDownload(doc.id, doc.original_file_name)}
                      className="client-doc-row flex items-center justify-between p-3 rounded-2xl border border-[#eaeef4] hover:bg-[#f8f9fb] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#eaeef4]/60 text-[#1b2559] flex items-center justify-center shrink-0">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-[#101828] group-hover:text-[#1b2559] transition-colors truncate max-w-[200px] sm:max-w-[280px]">
                            {doc.original_file_name}
                          </span>
                          <span className="text-xs text-[#667085] font-semibold">
                            {formatDocDate(doc.created_at)}
                          </span>
                        </div>
                      </div>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className="w-4 h-4 text-[#98a2b3] group-hover:text-[#1b2559] transition-colors"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </div>
                  ))}
                </div>
              ) : (
                uploadingFiles.length === 0 && (
                  <div className="py-12 text-center text-sm text-[#667085]">
                    No documents uploaded for this property yet.
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {isMobile ? renderMobileView() : renderDesktopView()}

      {/* Loan Details Overlay Modal */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md flex flex-col gap-5 shadow-2xl relative">
            <h3 className="text-lg font-bold text-[#101828]">Configure Loan Details</h3>

            <div className="flex flex-col gap-4">
              {/* Bank Name */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#667085]">Bank Name</label>
                <input
                  type="text"
                  value={formBankName}
                  onChange={(e) => setFormBankName(e.target.value)}
                  placeholder="e.g. Commonwealth Bank"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#eaeef4] text-sm text-[#101828] focus:outline-none focus:border-[#1b2559]"
                />
              </div>

              {/* BSB Number */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#667085]">BSB Number</label>
                <input
                  type="text"
                  value={formBsbNumber}
                  onChange={(e) => {
                    const formatted = handleBsbChange(e.target.value);
                    setFormBsbNumber(formatted);
                  }}
                  placeholder="e.g. 062-900"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#eaeef4] text-sm text-[#101828] focus:outline-none focus:border-[#1b2559]"
                />
              </div>

              {/* Account Number */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#667085]">Account Number</label>
                <input
                  type="text"
                  value={formAccountNumber}
                  onChange={(e) => setFormAccountNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 12345678"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#eaeef4] text-sm text-[#101828] focus:outline-none focus:border-[#1b2559]"
                />
              </div>

              {/* Loan Amount */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#667085]">Loan Amount</label>
                <input
                  type="number"
                  value={formLoanAmount}
                  onChange={(e) => setFormLoanAmount(e.target.value)}
                  placeholder="e.g. 500000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#eaeef4] text-sm text-[#101828] focus:outline-none focus:border-[#1b2559]"
                />
              </div>
            </div>

            {/* A div, not a <p>: globals.css styles bare p unlayered. */}
            {loanError && (
              <div role="alert" className="text-xs font-semibold text-red-600">
                {loanError}
              </div>
            )}

            <div className="flex items-center gap-2 mt-2">
              {loan && (
                <button
                  onClick={handleClearLoanDetails}
                  disabled={loanSaving}
                  className="px-4 py-2.5 border border-red-200 hover:bg-red-50 text-xs font-bold text-red-500 rounded-xl transition-all cursor-pointer mr-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete
                </button>
              )}
              <button
                onClick={() => setIsLoanModalOpen(false)}
                disabled={loanSaving}
                className="px-4 py-2.5 border border-[#eaeef4] hover:bg-gray-50 text-xs font-bold text-[#667085] rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLoanDetails}
                disabled={loanSaving}
                className="px-5 py-2.5 bg-[#1b2559] hover:bg-[#151c44] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-60 disabled:cursor-wait"
              >
                {loanSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
