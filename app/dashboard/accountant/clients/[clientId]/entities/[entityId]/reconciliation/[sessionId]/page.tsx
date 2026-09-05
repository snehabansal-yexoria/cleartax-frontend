"use client";

import Link from "next/link";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type {
  CoreProperty,
  CoreTransactionCategory,
  CoreTransactionListItem,
  CoreTransactionSubcategory,
  ReconciliationDetail,
  ReconciliationListItem,
  ReconciliationMatch,
  ReconciliationSessionDetail,
  ReconciliationTransaction,
  CoreAssetClass,
  CoreTransactionType,
} from "@/src/lib/coreApi";
import {
  TRANSACTION_TYPE_OPTIONS,
  allowsAssetPurchase,
  allowsBusinessExtras,
  allowsPersonalPortion,
  hidesCategoryPicker,
  hidesSubcategoryPicker,
  parseTransactionType,
} from "@/src/lib/transactionTypes";
import { withoutDedicatedFlowCategories } from "@/src/lib/borrowingCost";
import { getSession } from "@/src/lib/session";
import { AccountantReconciliationSkeleton } from "@/app/components/PortalSkeletons";
import { StaticSelect } from "@/app/components/TransactionsFeature";
import AssetBuilder, {
  AssetSummaryChip,
  assetRequestFields,
  type AssetDraft,
} from "@/app/components/AssetBuilder";

// ── Auth helpers ──────────────────────────────────────────────────────────────

function getToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)idToken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function getFreshToken(): Promise<string> {
  try {
    const session = await getSession();
    if (session) {
      const fresh = session.getIdToken().getJwtToken();
      document.cookie = `idToken=${fresh}; path=/`;
      return fresh;
    }
  } catch { /* fall through */ }
  return getToken();
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ReconciliationFilter = "all" | "matched" | "categorized";
type ReconciliationSort = "desc" | "asc";

type UploadStage =
  | { type: "idle" }
  | { type: "uploading"; progress: number }
  | { type: "starting" }
  | { type: "streaming"; stage: string; pagesDone: number; pagesTotal: number; txSoFar: number }
  | { type: "error"; message: string };

// Composite key: `${reconId}:${bankTxIndex}` — unique across all statements in
// the session, lets the match map / candidate map / expand state all live in a
// single store while transactions from multiple statements are visible at once.
type MatchKey = string;
const mkey = (reconId: string, bankTxIndex: number): MatchKey =>
  `${reconId}:${bankTxIndex}`;

type MatchUpdate =
  | { key: MatchKey; match: ReconciliationMatch }
  | { remove: MatchKey };

type CombinedRow = {
  reconId: string;
  statementLabel: string;
  bankTxIndex: number;
  row: ReconciliationTransaction;
};

type SplitRowState = { id: string; propertyId: string; amount: string };

let splitRowCounter = 0;
function makeSplitRowId() {
  splitRowCounter += 1;
  return `split-${splitRowCounter}`;
}

function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function computeCandidateMatches(
  combined: CombinedRow[],
  entityTxs: CoreTransactionListItem[],
): Map<MatchKey, CoreTransactionListItem[]> {
  const map = new Map<MatchKey, CoreTransactionListItem[]>();
  for (const { reconId, bankTxIndex, row } of combined) {
    const amount = row.debit ?? row.credit;
    if (amount == null) continue;
    const type = row.debit != null ? "expense" : "revenue";
    const hits = entityTxs.filter(
      (t) =>
        t.type === type && Math.abs(Math.abs(t.grossAmount) - amount) <= 0.02,
    );
    if (hits.length) map.set(mkey(reconId, bankTxIndex), hits);
  }
  return map;
}

function matchReducer(
  current: Map<MatchKey, ReconciliationMatch>,
  update: MatchUpdate,
): Map<MatchKey, ReconciliationMatch> {
  const next = new Map(current);
  if ("remove" in update) next.delete(update.remove);
  else next.set(update.key, update.match);
  return next;
}

const CURRENCY_SYMBOL = "A$ ";

function fmtAud(v: number | null | undefined): string {
  if (v == null) return "—";
  const isNegative = v < 0;
  const absVal = Math.abs(v);
  const formattedNumber = new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absVal);
  return isNegative
    ? `${CURRENCY_SYMBOL}- ${formattedNumber}`
    : `${CURRENCY_SYMBOL}${formattedNumber}`;
}

function shortId(id: string): string {
  return `TXN-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function statementLabelFor(rec: ReconciliationDetail): string {
  if (rec.account?.bank) {
    return rec.account.holder
      ? `${rec.account.bank} — ${rec.account.holder}`
      : rec.account.bank;
  }
  if (rec.createdAt) {
    const d = new Date(rec.createdAt);
    if (!Number.isNaN(d.getTime())) {
      return `Statement · ${d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`;
    }
  }
  return "Statement";
}

function downloadSampleCsv() {
  const template = [
    "Date,Transaction Name,Debit,Credit",
    "2026-07-02,Salary Credit,,45000.00",
    "2026-07-03,ATM Withdrawal,5000.00,",
    "2026-07-05,Electricity Bill,2200.00,",
  ].join("\n");
  const blob = new Blob([template], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "bank-statement-sample.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeStreamedDetail(raw: Record<string, unknown>): ReconciliationDetail {
  const summaryRaw = (raw.summary ?? raw.Summary) as Record<string, unknown> | null;
  const accountRaw = (raw.account ?? raw.Account) as Record<string, unknown> | null;
  const txRaw = Array.isArray(raw.transactions) ? (raw.transactions as Record<string, unknown>[]) : [];
  return {
    id: String(raw.id ?? raw.job_id ?? ""),
    status: String(raw.status ?? "done"),
    totalPages: raw.total_pages != null ? Number(raw.total_pages) : null,
    failedPages: Array.isArray(raw.failed_pages) ? (raw.failed_pages as number[]) : null,
    errorMessage: raw.error_message ? String(raw.error_message) : null,
    createdAt: String(raw.created_at ?? new Date().toISOString()),
    updatedAt: String(raw.updated_at ?? new Date().toISOString()),
    summary: summaryRaw ? {
      totalTransactions: Number(summaryRaw.total_transactions ?? summaryRaw.totalTransactions ?? 0),
      totalDebits: Number(summaryRaw.total_debits ?? summaryRaw.totalDebits ?? 0),
      totalCredits: Number(summaryRaw.total_credits ?? summaryRaw.totalCredits ?? 0),
      pagesProcessed: Number(summaryRaw.pages_processed ?? summaryRaw.pagesProcessed ?? 0),
      pagesSkipped: Number(summaryRaw.pages_skipped ?? summaryRaw.pagesSkipped ?? 0),
      processingTimeSeconds: Number(summaryRaw.processing_time_seconds ?? summaryRaw.processingTimeSeconds ?? 0),
      skippedRows: Array.isArray(summaryRaw.skipped_rows ?? summaryRaw.skippedRows)
        ? ((summaryRaw.skipped_rows ?? summaryRaw.skippedRows) as Record<string, unknown>[]).map((r) => ({
          line: Number(r.line ?? 0),
          reason: String(r.reason ?? ""),
        }))
        : [],
    } : null,
    account: accountRaw ? {
      bank: String(accountRaw.bank ?? ""),
      accountNumber: String(accountRaw.account_number ?? accountRaw.accountNumber ?? ""),
      accountType: String(accountRaw.account_type ?? accountRaw.accountType ?? ""),
      holder: String(accountRaw.holder ?? ""),
      statementPeriod: {
        from: String((accountRaw.statement_period as Record<string, unknown>)?.from ?? ""),
        to: String((accountRaw.statement_period as Record<string, unknown>)?.to ?? ""),
      },
      openingBalance: Number(accountRaw.opening_balance ?? accountRaw.openingBalance ?? 0),
      closingBalance: Number(accountRaw.closing_balance ?? accountRaw.closingBalance ?? 0),
    } : null,
    transactions: txRaw.map((t) => ({
      date: String(t.date ?? ""),
      description: String(t.description ?? ""),
      payee: t.payee ? String(t.payee) : null,
      debit: t.debit != null ? Number(t.debit) : null,
      credit: t.credit != null ? Number(t.credit) : null,
      balance: t.balance != null ? Number(t.balance) : null,
    })),
  };
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  );
}

function UploadIcon({ width = 18, height = 18 }: { width?: number; height?: number } = {}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={width}
      height={height}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function UploadAltIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={13}
      height={13}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function playReconSound() {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    [440, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.35, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  } catch { /* AudioContext blocked */ }
}

function ReconCompleteToast({
  href,
  onClose,
}: {
  href: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 12_000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="recon-toast">
      <div className="recon-toast-icon">
        <svg viewBox="0 0 24 24" aria-hidden="true" width={20} height={20}>
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </div>
      <div className="recon-toast-body">
        <strong>Statement extracted!</strong>
        <span>The new statement is ready below.</span>
      </div>
      <Link href={href} className="recon-toast-link" onClick={onClose}>
        View →
      </Link>
      <button type="button" className="recon-toast-close" onClick={onClose} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AccountantReconciliationSessionPage() {
  const params = useParams<{ clientId: string; entityId: string; sessionId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const clientId = String(params?.clientId ?? "");
  const entityId = String(params?.entityId ?? "");
  const sessionId = String(params?.sessionId ?? "");

  // Session + statements list
  const [session, setSession] = useState<ReconciliationSessionDetail | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Multi-statement state. selectedHistoryIds drives selectedRecons via the
  // reconCache: opening a checkbox loads the detail (if not cached) and
  // surfaces its transactions in the combined table below.
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const [reconCache, setReconCache] = useState<Map<string, ReconciliationDetail>>(new Map());
  const [reconLoadingIds, setReconLoadingIds] = useState<Set<string>>(new Set());

  // Upload flow
  const [uploadStage, setUploadStage] = useState<UploadStage>({ type: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [matchError, setMatchError] = useState<string | null>(null);
  const [confirmingKey, setConfirmingKey] = useState<MatchKey | null>(null);

  // Matching state — all composite-keyed
  const [entityTxs, setEntityTxs] = useState<CoreTransactionListItem[]>([]);
  const [entityTxsLoading, setEntityTxsLoading] = useState(false);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [confirmedMatches, setConfirmedMatches] = useState<Map<MatchKey, ReconciliationMatch>>(new Map());
  const [expandedKey, setExpandedKey] = useState<MatchKey | null>(null);
  const [properties, setProperties] = useState<CoreProperty[]>([]);
  const [assignedProperties, setAssignedProperties] = useState<Map<MatchKey, string>>(new Map());
  const [reconPage, setReconPage] = useState(1);
  const [pageSize, setPageSize] = useState<string>("20");
  const [pageInputValue, setPageInputValue] = useState<string>("20");

  useEffect(() => {
    setPageInputValue(String(reconPage));
  }, [reconPage]);

  const [toastReconId, setToastReconId] = useState<string | null>(null);

  // Session completion
  const [completingSession, setCompletingSession] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  // Table filter/sort
  const [activeTab, setActiveTab] = useState<"unreviewed" | "reviewed" | "excluded">("unreviewed");

  useEffect(() => {
    setSelectedRowKeys(new Set());
  }, [activeTab]);

  const [filter, setFilter] = useState<ReconciliationFilter>("all");
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<ReconciliationSort>("desc");
  const [openSortDropdown, setOpenSortDropdown] = useState<string | null>(null);
  const [past30DaysOnly, setPast30DaysOnly] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());

  const [optimisticMatches, addOptimisticMatch] = useOptimistic<
    Map<MatchKey, ReconciliationMatch>,
    MatchUpdate
  >(confirmedMatches, matchReducer);
  const [isPending, startTransition] = useTransition();
  const deferredEntityTxs = useDeferredValue(entityTxs);

  // Categorize panel
  const [categorizeKey, setCategorizeKey] = useState<MatchKey | null>(null);
  // One type, the API's. This used to be two pieces of state — an "expense" |
  // "revenue" value for the request and a wider display union — which had to be
  // kept in sync on every change.
  const [categorizeType, setCategorizeType] = useState<CoreTransactionType>("expense");
  const [categorizeCategoryId, setCategorizeCategoryId] = useState<number | null>(null);
  const [categorizeSubcategoryId, setCategorizeSubcategoryId] = useState<number | null>(null);
  const [categorizePropertyId, setCategorizePropertyId] = useState<string>("");
  const [categorizeGst, setCategorizeGst] = useState<boolean>(false);
  const [categorizeGstAmount, setCategorizeGstAmount] = useState<string>("");
  const [categorizeCategories, setCategorizeCategories] = useState<CoreTransactionCategory[]>([]);
  const [categorizeSubcategories, setCategorizeSubcategories] = useState<CoreTransactionSubcategory[]>([]);
  const [categorizeSaving, setCategorizeSaving] = useState(false);
  const [categorizeError, setCategorizeError] = useState<string | null>(null);

  const [categorizeIsSplit, setCategorizeIsSplit] = useState(false);
  const [categorizeSplitRows, setCategorizeSplitRows] = useState<SplitRowState[]>(() => [
    { id: makeSplitRowId(), propertyId: "", amount: "" },
  ]);

  // New states from add transaction form
  // One draft rather than nine loose fields across a three-step wizard. The old
  // shape wrote the name and the method into `metadata`, where nothing read
  // them, and only when the name was non-empty — so a categorized asset could
  // reach the ledger with no depreciation method at all.
  const [categorizeAssetDraft, setCategorizeAssetDraft] = useState<AssetDraft | null>(null);
  const categorizeIsAssetPurchase = categorizeAssetDraft !== null;

  const [assetBuilderOpen, setAssetBuilderOpen] = useState(false);

  const [categorizeIsPersonal, setCategorizeIsPersonal] = useState(false);
  const [categorizePersonalAllocationType, setCategorizePersonalAllocationType] = useState<"percentage" | "amount">("percentage");
  const [categorizePersonalValue, setCategorizePersonalValue] = useState("20");

  const [categorizeIsRegularPayment, setCategorizeIsRegularPayment] = useState(false);
  const [categorizeDueDate, setCategorizeDueDate] = useState("");
  const [categorizeDueDateTouched, setCategorizeDueDateTouched] = useState(false);
  const [categorizeAlertName, setCategorizeAlertName] = useState("");
  const [categorizeUserEditedAlertName, setCategorizeUserEditedAlertName] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkType, setBulkType] = useState<CoreTransactionType>("expense");
  const [bulkCategoryId, setBulkCategoryId] = useState<number | null>(null);
  const [bulkSubcategoryId, setBulkSubcategoryId] = useState<number | null>(null);
  const [bulkPropertyId, setBulkPropertyId] = useState<string>("");
  const [bulkGst, setBulkGst] = useState(false);
  const [bulkCategories, setBulkCategories] = useState<CoreTransactionCategory[]>([]);
  const [bulkSubcategories, setBulkSubcategories] = useState<CoreTransactionSubcategory[]>([]);
  // Bulk private-use split. Percentage ONLY, deliberately — the single-line
  // drawer offers "percentage or amount", but a fixed dollar amount applied
  // across a set of differently-sized bank lines is meaningless, and on any
  // line smaller than the amount it would clamp the business side to zero and
  // break the invariant that the two children sum to their parent.
  const [bulkIsPersonal, setBulkIsPersonal] = useState(false);
  const [bulkPersonalPercentage, setBulkPersonalPercentage] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkExcluding, setBulkExcluding] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const canSplitTransaction = properties.length > 1;

  const showCategorizeSubcategorySelect =
    !!categorizeCategoryId &&
    categorizeSubcategories.some((s) => s.name.toLowerCase() !== "general");

  const showBulkSubcategorySelect =
    !!bulkCategoryId &&
    bulkSubcategories.some((s) => s.name.toLowerCase() !== "general");

  // Applied identically to every selected line, so it is validated once here
  // rather than per row.
  const bulkPersonalError = useMemo(() => {
    if (!bulkIsPersonal) return "";
    const pct = Number.parseFloat(bulkPersonalPercentage);
    if (!Number.isFinite(pct) || pct <= 0) return "Enter a personal percentage above 0.";
    if (pct >= 100) {
      return "Personal use must be under 100%. Categorize these as Personal Transactions instead.";
    }
    return "";
  }, [bulkIsPersonal, bulkPersonalPercentage]);

  const activeBankTx = useMemo(() => {
    if (!categorizeKey) return null;
    const [reconId, idxStr] = categorizeKey.split(":");
    const rec = reconCache.get(reconId);
    if (!rec) return null;
    const idx = Number(idxStr);
    return rec.transactions[idx] ?? null;
  }, [categorizeKey, reconCache]);

  const activeGrossAmount = activeBankTx ? (activeBankTx.debit ?? activeBankTx.credit ?? 0) : 0;

  const categorizeSplitTotal = useMemo(() => {
    return categorizeSplitRows.reduce(
      (sum, r) => sum + (Number.parseFloat(r.amount) || 0),
      0,
    );
  }, [categorizeSplitRows]);

  const categorizeSplitErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!categorizeIsSplit) return errors;
    if (categorizeSplitRows.length < 2) {
      errors.__form = "Add at least two property rows for a split transaction.";
    }
    const seen = new Set<string>();
    const allBlank = categorizeSplitRows.every((row) => !row.amount || !row.amount.trim());
    for (const r of categorizeSplitRows) {
      if (!r.propertyId) {
        errors[r.id] = "Choose a property.";
      } else if (seen.has(r.propertyId)) {
        errors[r.id] = "Property already used in another split.";
      } else if (!allBlank && (!r.amount || Number.parseFloat(r.amount) <= 0)) {
        errors[r.id] = "Enter a positive amount.";
      }
      if (r.propertyId) seen.add(r.propertyId);
    }
    if (seen.size > 0 && seen.size < 2) {
      errors.__form = "Choose more than one property for a split transaction.";
    }
    return errors;
  }, [categorizeIsSplit, categorizeSplitRows]);

  const categorizeSplitMatches = useMemo(() => {
    return (
      activeGrossAmount > 0 &&
      Math.abs(categorizeSplitTotal - activeGrossAmount) < 0.01
    );
  }, [activeGrossAmount, categorizeSplitTotal]);

  function updateCategorizeSplitRow(id: string, patch: Partial<SplitRowState>) {
    setCategorizeSplitRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  function addCategorizeSplitRow() {
    setCategorizeSplitRows((rows) => [
      ...rows,
      { id: makeSplitRowId(), propertyId: "", amount: "" },
    ]);
  }

  function removeCategorizeSplitRow(id: string) {
    setCategorizeSplitRows((rows) =>
      rows.length <= 1 ? rows : rows.filter((r) => r.id !== id),
    );
  }

  function handleCategorizeSplitToggle(checked: boolean) {
    if (checked && !canSplitTransaction) {
      const msg = properties.length === 1
        ? "Split transactions need at least two properties in this entity. This entity only has one property."
        : "Add at least two properties to this entity before creating a split transaction.";
      setCategorizeError(msg);
    } else {
      if (categorizeError && categorizeError.toLowerCase().includes("split")) {
        setCategorizeError(null);
      }
    }
    setCategorizeIsSplit(checked);
    if (checked) {
      setCategorizeSplitRows((rows) => {
        if (
          rows.length === 1 &&
          !rows[0].propertyId &&
          !rows[0].amount &&
          categorizePropertyId
        ) {
          return [{ ...rows[0], propertyId: categorizePropertyId, amount: String(activeGrossAmount || "") }];
        }
        return rows;
      });
      return;
    }
    setCategorizeSplitRows([{ id: makeSplitRowId(), propertyId: "", amount: "" }]);
  }

  const handleConfirmComplete = async () => {
    setShowCompleteConfirm(false);
    setCompleteError(null);
    setCompletingSession(true);
    try {
      const token = await getFreshToken();
      const res = await fetch(
        `/api/entities/${entityId}/reconciliation-sessions/${sessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: "completed" }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string; error?: string };
        setCompleteError(body.message ?? body.error ?? "Failed to complete reconciliation.");
        return;
      }
      playReconSound();
      router.push(`/dashboard/accountant/clients/${clientId}/entities/${entityId}?tab=reconciliation`);
    } catch {
      setCompleteError("Something went wrong. Please try again.");
    } finally {
      setCompletingSession(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const statements: ReconciliationListItem[] = session?.statements ?? [];
  const isSessionCompleted = session?.status === "completed";

  const selectedRecons: ReconciliationDetail[] = useMemo(() => {
    const out: ReconciliationDetail[] = [];
    for (const id of selectedHistoryIds) {
      const cached = reconCache.get(id);
      if (cached) out.push(cached);
    }
    return out;
  }, [selectedHistoryIds, reconCache]);

  const combinedRows: CombinedRow[] = useMemo(() => {
    const out: CombinedRow[] = [];
    for (const rec of selectedRecons) {
      const label = statementLabelFor(rec);
      rec.transactions.forEach((row, i) => {
        out.push({ reconId: rec.id, statementLabel: label, bankTxIndex: i, row });
      });
    }
    return out;
  }, [selectedRecons]);

  // Selected rows that can still be bulk-actioned (not yet confirmed or excluded).
  const selectedEligibleRows = useMemo(
    () =>
      combinedRows.filter(({ reconId, bankTxIndex }) => {
        const key = mkey(reconId, bankTxIndex);
        if (!selectedRowKeys.has(key)) return false;
        const status = optimisticMatches.get(key)?.status;
        return status !== "confirmed" && status !== "excluded";
      }),
    [combinedRows, selectedRowKeys, optimisticMatches],
  );

  const selectedExcludedRows = useMemo(
    () =>
      combinedRows.filter(({ reconId, bankTxIndex }) => {
        const key = mkey(reconId, bankTxIndex);
        if (!selectedRowKeys.has(key)) return false;
        const status = optimisticMatches.get(key)?.status;
        return status === "excluded";
      }),
    [combinedRows, selectedRowKeys, optimisticMatches],
  );

  const selectedType = useMemo(() => {
    if (selectedEligibleRows.length === 0) return null;
    const firstRow = selectedEligibleRows[0].row;
    return firstRow.credit != null ? "revenue" : "expense";
  }, [selectedEligibleRows]);


  const aggregatedSummary = useMemo(() => {
    let totalTransactions = 0;
    let totalDebits = 0;
    let totalCredits = 0;
    for (const rec of selectedRecons) {
      const s = rec.summary;
      if (s) {
        totalTransactions += s.totalTransactions;
        totalDebits += s.totalDebits;
        totalCredits += s.totalCredits;
      } else {
        totalTransactions += rec.transactions.length;
      }
    }
    return { totalTransactions, totalDebits, totalCredits };
  }, [selectedRecons]);

  // ── Data fetching ────────────────────────────────────────────────────────

  // Properties + entity txs (entity-scoped, load once)
  useEffect(() => {
    const token = getToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    setEntityTxsLoading(true);
    fetch(`/api/entities/${entityId}/properties`, { headers })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: CoreProperty[] }) => setProperties(data.items ?? []))
      .catch(() => { });
    fetch(`/api/entities/${entityId}/transactions`, { headers })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: CoreTransactionListItem[] }) => setEntityTxs(data.items ?? []))
      .catch(() => setEntityTxs([]))
      .finally(() => setEntityTxsLoading(false));
  }, [entityId]);

  // Load the session + its statements
  const refreshSession = useCallback(async () => {
    const token = getToken();
    const res = await fetch(
      `/api/entities/${entityId}/reconciliation-sessions/${sessionId}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!res.ok) {
      setSessionError(res.status === 404 ? "Reconciliation session not found." : `Failed to load session (${res.status}).`);
      setSession(null);
      return null;
    }
    const data = (await res.json()) as ReconciliationSessionDetail;
    setSession(data);
    setSessionError(null);
    return data;
  }, [entityId, sessionId]);

  useEffect(() => {
    if (!entityId || !sessionId) return;
    let cancelled = false;
    setSessionLoading(true);
    refreshSession()
      .then((data) => {
        if (cancelled || !data) return;
        // Pre-select via ?id= deep link; otherwise auto-select the most recent statement.
        const deepId = searchParams.get("id");
        if (deepId && data.statements.some((s) => s.id === deepId)) {
          setSelectedHistoryIds([deepId]);
        } else if (data.statements.length > 0) {
          const newest = [...data.statements].sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt),
          )[0];
          if (newest) setSelectedHistoryIds([newest.id]);
        }
      })
      .finally(() => { if (!cancelled) setSessionLoading(false); });
    return () => { cancelled = true; };
    // refreshSession changes when entityId/sessionId change — covered.
    // searchParams intentionally excluded so later param changes don't reset selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, sessionId, refreshSession]);

  // Load details for any selected statement that isn't cached yet
  useEffect(() => {
    const token = getToken();
    const missing = selectedHistoryIds.filter(
      (id) => !reconCache.has(id) && !reconLoadingIds.has(id),
    );
    if (missing.length === 0) return;
    setReconLoadingIds((cur) => {
      const next = new Set(cur);
      for (const id of missing) next.add(id);
      return next;
    });
    for (const id of missing) {
      fetch(`/api/entities/${entityId}/reconciliations/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: ReconciliationDetail | null) => {
          if (!data) return;
          setReconCache((cur) => {
            const next = new Map(cur);
            next.set(id, data);
            return next;
          });
        })
        .catch(() => { })
        .finally(() => {
          setReconLoadingIds((cur) => {
            const next = new Set(cur);
            next.delete(id);
            return next;
          });
        });
    }
  }, [selectedHistoryIds, reconCache, reconLoadingIds, entityId]);

  // Whenever the set of selected recons changes, fetch matches per recon and
  // merge into one map keyed by mkey(reconId, bankTxIndex).
  const reloadMatches = useCallback(async () => {
    const token = getToken();
    if (selectedHistoryIds.length === 0) {
      setConfirmedMatches(new Map());
      return;
    }
    setMatchesLoading(true);
    try {
      const results = await Promise.all(
        selectedHistoryIds.map((id) =>
          fetch(
            `/api/entities/${entityId}/reconciliations/${id}/matches`,
            { headers: token ? { Authorization: `Bearer ${token}` } : {} },
          )
            .then((r) => (r.ok ? r.json() : []))
            .then((data: ReconciliationMatch[]) =>
              (Array.isArray(data) ? data : []).map((m) => ({ reconId: id, m })),
            )
            .catch(() => [] as { reconId: string; m: ReconciliationMatch }[]),
        ),
      );
      const merged = new Map<MatchKey, ReconciliationMatch>();
      for (const list of results) {
        for (const { reconId, m } of list) {
          merged.set(mkey(reconId, m.bankTxIndex), m);
        }
      }
      setConfirmedMatches(merged);
    } finally {
      setMatchesLoading(false);
    }
  }, [selectedHistoryIds, entityId]);

  useEffect(() => { void reloadMatches(); }, [reloadMatches]);

  // ── Categorize panel: load categories / subcategories ────────────────────

  useEffect(() => {
    if (categorizeKey === null) return;
    const [reconId, idxStr] = categorizeKey.split(":");
    const rec = reconCache.get(reconId);
    if (!rec) return;
    const idx = Number(idxStr);
    const bankTx = rec.transactions[idx];
    if (!bankTx) return;
    // A bank line only tells us the direction; personal / cost base is a
    // judgement the accountant makes in the drawer, so default from debit vs
    // credit and let them change it.
    setCategorizeType(bankTx.debit != null ? "expense" : "revenue");

    // Reset new states
    setCategorizeAssetDraft(null);
    setAssetBuilderOpen(false);

    setCategorizeIsPersonal(false);
    setCategorizePersonalAllocationType("percentage");
    setCategorizePersonalValue("");

    setCategorizeIsRegularPayment(false);
    setCategorizeDueDate("");
    setCategorizeDueDateTouched(false);
    setCategorizeAlertName("");
    setCategorizeUserEditedAlertName(false);

    setCategorizeCategoryId(null);
    setCategorizeSubcategoryId(null);
    setCategorizeSubcategories([]);
    setCategorizeGst(false);
    setCategorizeGstAmount("");
    setCategorizeIsSplit(false);
    setCategorizeSplitRows([{ id: makeSplitRowId(), propertyId: "", amount: "" }]);
  }, [categorizeKey, reconCache]);

  useEffect(() => {
    if (categorizeKey === null) return;
    let cancelled = false;
    void getFreshToken().then((token) => {
      fetch(`/api/transactions/categories?type=${categorizeType}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d: { items?: CoreTransactionCategory[] }) => {
          if (!cancelled) {
            setCategorizeCategories(
              withoutDedicatedFlowCategories(d.items ?? []),
            );
          }
        })
        .catch(() => { });
    });
    return () => { cancelled = true; };
  }, [categorizeKey, categorizeType]);

  useEffect(() => {
    if (!categorizeCategoryId) { setCategorizeSubcategories([]); return; }
    let cancelled = false;
    void getFreshToken().then((token) => {
      fetch(`/api/transactions/categories/${categorizeCategoryId}/sub-categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d: { items?: CoreTransactionSubcategory[] }) => {
          if (!cancelled) {
            const loaded = d.items ?? [];
            setCategorizeSubcategories(loaded);
            const actual = loaded.filter((s) => s.name.toLowerCase() !== "general");
            if (actual.length === 0 && loaded.length > 0) {
              setCategorizeSubcategoryId(loaded[0].id);
            } else {
              setCategorizeSubcategoryId(null);
            }
          }
        })
        .catch(() => { });
    });
    return () => { cancelled = true; };
  }, [categorizeCategoryId]);

  // The asset section stays visible for revenue (as it always has), but the
  // backend only accepts is_asset_purchase on an expense, so clear it rather
  // than letting the save fail. Mirrors the same guard in AddTransactionView.
  useEffect(() => {
    if (!allowsAssetPurchase(categorizeType) && categorizeAssetDraft) {
      setCategorizeAssetDraft(null);
    }
  }, [categorizeType, categorizeAssetDraft]);

  // Personal hides the category picker and cost base hides the subcategory
  // picker, so auto-select from the typed category fetch. Since migration 0032
  // seeds a taxonomy per type, this is a plain first-option pick rather than
  // matching category names against "personal"/"private".
  useEffect(() => {
    if (hidesCategoryPicker(categorizeType) && !categorizeCategoryId && categorizeCategories[0]) {
      setCategorizeCategoryId(categorizeCategories[0].id);
    }
  }, [categorizeType, categorizeCategories, categorizeCategoryId]);

  useEffect(() => {
    if (hidesSubcategoryPicker(categorizeType) && !categorizeSubcategoryId && categorizeSubcategories[0]) {
      setCategorizeSubcategoryId(categorizeSubcategories[0].id);
    }
  }, [categorizeType, categorizeSubcategories, categorizeSubcategoryId]);

  useEffect(() => {
    if (!allowsBusinessExtras(categorizeType) && !categorizePropertyId && properties.length > 0) {
      setCategorizePropertyId(properties[0].id);
    }
  }, [categorizeType, categorizePropertyId, properties]);

  // Auto-populate Alert Name based on subcategory and property
  useEffect(() => {
    if (categorizeUserEditedAlertName) return;
    const subcat = categorizeSubcategories.find((s) => s.id === categorizeSubcategoryId);
    const subcatName = subcat ? subcat.name : "";
    const prop = properties.find((p) => p.id === categorizePropertyId);
    const propName = prop ? prop.name : "";
    if (subcatName && propName) {
      setCategorizeAlertName(`${subcatName} - ${propName}`);
    } else if (subcatName) {
      setCategorizeAlertName(subcatName);
    } else if (propName) {
      setCategorizeAlertName(propName);
    } else {
      setCategorizeAlertName("");
    }
  }, [categorizeSubcategoryId, categorizePropertyId, categorizeSubcategories, properties, categorizeUserEditedAlertName]);

  // Private-use split of a business expense. A wholly personal transaction is
  // type === "personal" and carries no split, so categorizeIsPersonal is false.
  //
  // Both input modes collapse to a percentage: that is the only shape the API
  // accepts, because the backend derives the two child rows from it and they
  // have to keep summing back to the parent bill.
  const categorizePersonalPercentage = useMemo(() => {
    if (!categorizeIsPersonal) return 0;
    const raw = Number.parseFloat(categorizePersonalValue) || 0;
    if (categorizePersonalAllocationType === "percentage") return raw;
    if (activeGrossAmount <= 0) return 0;
    return (raw / activeGrossAmount) * 100;
  }, [categorizeIsPersonal, categorizePersonalAllocationType, categorizePersonalValue, activeGrossAmount]);

  const categorizePersonalPortion = useMemo(
    () => activeGrossAmount * (categorizePersonalPercentage / 100),
    [activeGrossAmount, categorizePersonalPercentage],
  );

  const categorizeBusinessPortion = useMemo(() => {
    if (!categorizeIsPersonal) return activeGrossAmount;
    return activeGrossAmount - categorizePersonalPortion;
  }, [categorizeIsPersonal, activeGrossAmount, categorizePersonalPortion]);

  // Strictly partial at both ends — nothing private is just an expense, and
  // wholly private is the Personal Transaction type rather than a 100% split.
  const categorizePersonalError = useMemo(() => {
    if (!categorizeIsPersonal) return "";
    if (activeGrossAmount <= 0) return "This line has no amount to split.";
    if (categorizePersonalPercentage <= 0) return "Enter a personal portion above 0.";
    if (categorizePersonalPercentage >= 100) {
      return "The personal portion must be less than the whole amount. Use the Personal Transaction type instead.";
    }
    return "";
  }, [categorizeIsPersonal, activeGrossAmount, categorizePersonalPercentage]);

  const categorizeDueDateError = useMemo(() => {
    if (!categorizeDueDate) {
      return "Due date is required.";
    }
    const todayStr = getLocalDateString();
    if (categorizeDueDate < todayStr) {
      return "Due date must be in the future.";
    }
    return "";
  }, [categorizeDueDate]);

  // ── Bulk categorize modal: load categories / subcategories ───────────────

  useEffect(() => {
    if (!bulkOpen) return;
    let cancelled = false;
    void getFreshToken().then((token) => {
      fetch(`/api/transactions/categories?type=${bulkType}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d: { items?: CoreTransactionCategory[] }) => {
          if (!cancelled) {
            setBulkCategories(withoutDedicatedFlowCategories(d.items ?? []));
          }
        })
        .catch(() => { });
    });
    return () => { cancelled = true; };
  }, [bulkOpen, bulkType]);

  useEffect(() => {
    if (!bulkCategoryId) { setBulkSubcategories([]); return; }
    let cancelled = false;
    void getFreshToken().then((token) => {
      fetch(`/api/transactions/categories/${bulkCategoryId}/sub-categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d: { items?: CoreTransactionSubcategory[] }) => {
          if (!cancelled) {
            const loaded = d.items ?? [];
            setBulkSubcategories(loaded);
            const actual = loaded.filter((s) => s.name.toLowerCase() !== "general");
            if (actual.length === 0 && loaded.length > 0) {
              setBulkSubcategoryId(loaded[0].id);
            } else {
              setBulkSubcategoryId(null);
            }
          }
        })
        .catch(() => { });
    });
    return () => { cancelled = true; };
  }, [bulkCategoryId]);

  useEffect(() => {
    if (!openSortDropdown) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".sortable-header")) {
        setOpenSortDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [openSortDropdown]);

  // ── SSE for upload ────────────────────────────────────────────────────────

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopStatusPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const removePendingJob = useCallback((jobId: string) => {
    try {
      const stored = JSON.parse(localStorage.getItem("cleartax_recon_pending") ?? "[]") as Array<{ jobId: string }>;
      localStorage.setItem("cleartax_recon_pending", JSON.stringify(stored.filter((j) => j.jobId !== jobId)));
    } catch { /* ignore */ }
  }, []);

  // The SSE stream can die while the pipeline keeps running (App Runner caps
  // request duration, so long extractions outlive the connection). The DB row
  // is the source of truth: poll it until done/error instead of declaring
  // failure the moment the stream drops.
  const beginStatusPolling = useCallback(
    (jobId: string, reconciliationId: string) => {
      if (!reconciliationId) {
        setUploadStage({ type: "error", message: "Connection lost. Refresh the page to check whether extraction finished." });
        return;
      }
      stopStatusPolling();
      const deadline = Date.now() + 30 * 60 * 1000;

      const poll = async () => {
        let status: string | null = null;
        let errorMessage: string | null = null;
        try {
          const token = getToken();
          const res = await fetch(`/api/entities/${entityId}/reconciliations/${reconciliationId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) {
            const detail = (await res.json()) as ReconciliationDetail;
            status = detail.status ?? null;
            errorMessage = detail.errorMessage ?? null;
          }
        } catch { /* transient — retry below */ }

        if (status === "done" || status === "completed") {
          removePendingJob(jobId);
          setUploadStage({ type: "idle" });
          setFeedbackMessage("Bank statement extracted successfully.");
          setSelectedHistoryIds((cur) => (cur.includes(reconciliationId) ? cur : [...cur, reconciliationId]));
          setToastReconId(reconciliationId);
          playReconSound();
          void refreshSession();
          return;
        }
        if (status === "error" || status === "failed") {
          removePendingJob(jobId);
          setUploadStage({ type: "error", message: errorMessage ?? "Extraction failed. Please try again." });
          void refreshSession();
          return;
        }
        if (Date.now() > deadline) {
          setUploadStage({ type: "error", message: "Lost track of the extraction. Refresh the page to check whether it finished." });
          return;
        }
        pollTimerRef.current = setTimeout(() => { void poll(); }, 5000);
      };

      void poll();
    },
    [entityId, refreshSession, removePendingJob, stopStatusPolling],
  );

  useEffect(() => () => {
    stopStatusPolling();
    if (eventSourceRef.current) eventSourceRef.current.close();
  }, [stopStatusPolling]);

  const connectSSE = useCallback(
    (jobId: string, reconciliationId: string) => {
      const token = getToken();
      stopStatusPolling();
      if (eventSourceRef.current) eventSourceRef.current.close();

      const url = `/api/reconciliation/stream?job_id=${encodeURIComponent(jobId)}${token ? `&token=${encodeURIComponent(token)}` : ""}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.addEventListener("status", (e) => {
        const d = JSON.parse((e as MessageEvent).data);
        setUploadStage({ type: "streaming", stage: d.stage, pagesDone: 0, pagesTotal: d.pages_total ?? 0, txSoFar: 0 });
      });

      es.addEventListener("progress", (e) => {
        const d = JSON.parse((e as MessageEvent).data);
        setUploadStage({ type: "streaming", stage: d.stage, pagesDone: d.pages_done, pagesTotal: d.pages_total, txSoFar: d.transactions_so_far });
      });

      es.addEventListener("done", (e) => {
        es.close();
        const raw = JSON.parse((e as MessageEvent).data) as Record<string, unknown>;
        const normalized = normalizeStreamedDetail(raw);
        if (!normalized.id) return;
        setReconCache((cur) => {
          const next = new Map(cur);
          next.set(normalized.id, normalized);
          return next;
        });
        setSelectedHistoryIds((cur) => cur.includes(normalized.id) ? cur : [...cur, normalized.id]);
        setUploadStage({ type: "idle" });
        setFeedbackMessage("Bank statement extracted successfully.");
        setToastReconId(normalized.id);
        playReconSound();
        removePendingJob(jobId);
        void refreshSession();
      });

      // EventSource fires "error" for two very different things: a backend
      // `event: error` (has .data — the pipeline really failed) and any
      // transport drop (no .data — the job is likely still running). Only the
      // former is a verdict; for the latter, fall back to polling the DB row.
      es.addEventListener("error", (e) => {
        es.close();
        const data = (e as MessageEvent).data as string | undefined;
        if (data) {
          let message = "Extraction failed. Please try again.";
          try {
            const d = JSON.parse(data) as { message?: string };
            if (d.message) message = d.message;
          } catch { /* keep fallback */ }
          removePendingJob(jobId);
          setUploadStage({ type: "error", message });
          void refreshSession();
        } else {
          beginStatusPolling(jobId, reconciliationId);
        }
      });
    },
    [refreshSession, beginStatusPolling, removePendingJob, stopStatusPolling],
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.match(/\.(pdf|csv)$/i)) {
        setUploadStage({ type: "error", message: "Only PDF or CSV files are supported." });
        return;
      }
      if (isSessionCompleted) {
        setUploadStage({ type: "error", message: "This reconciliation session is completed." });
        return;
      }
      const token = getToken();
      try {
        setUploadStage({ type: "uploading", progress: 10 });
        const presignRes = await fetch(
          `/api/documents/presign?filename=${encodeURIComponent(file.name)}&document_type=bank_statement&entity_id=${encodeURIComponent(entityId)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        if (!presignRes.ok) throw new Error("Failed to get upload URL");
        const { upload_url: uploadUrl, s3_key: s3Key } = await presignRes.json();

        setUploadStage({ type: "uploading", progress: 40 });
        const isCsv = /\.csv$/i.test(file.name);
        const uploadRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": isCsv ? "text/csv" : "application/pdf" } });
        if (!uploadRes.ok) throw new Error("Upload to storage failed");
        setUploadStage({ type: "uploading", progress: 90 });

        setUploadStage({ type: "starting" });
        const startRes = await fetch("/api/reconciliation", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ s3_key: s3Key, entity_id: entityId, session_id: sessionId }),
        });
        if (!startRes.ok) throw new Error("Failed to start reconciliation");
        const { jobId, reconciliationId } = (await startRes.json()) as {
          jobId: string;
          reconciliationId?: string;
        };

        try {
          const stored = JSON.parse(localStorage.getItem("cleartax_recon_pending") ?? "[]") as unknown[];
          stored.push({ jobId, reconciliationId: reconciliationId ?? "", entityId, clientId, sessionId, startedAt: Date.now() });
          localStorage.setItem("cleartax_recon_pending", JSON.stringify(stored));
        } catch { /* ignore */ }

        setUploadStage({ type: "streaming", stage: "downloading", pagesDone: 0, pagesTotal: 0, txSoFar: 0 });
        connectSSE(jobId, reconciliationId ?? "");
      } catch (err) {
        setUploadStage({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
      }
    },
    [entityId, clientId, sessionId, isSessionCompleted, connectSSE],
  );

  // ── Match actions — all composite-keyed ──────────────────────────────────

  async function doConfirmMatch(reconId: string, bankTxIndex: number, candidate: CoreTransactionListItem) {
    const key = mkey(reconId, bankTxIndex);
    if (confirmingKey !== null) return;
    setMatchError(null);
    setConfirmingKey(key);
    try {
      const res = await fetch(
        `/api/entities/${entityId}/reconciliations/${reconId}/matches`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getFreshToken()}` },
          body: JSON.stringify({ bankTxIndex, transactionId: candidate.id, status: "confirmed" }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        setMatchError(body.message ?? "Failed to confirm match");
        return;
      }
      await reloadMatches();
      setExpandedKey(null);
    } catch {
      setMatchError("Failed to confirm match. Please try again.");
    } finally {
      setConfirmingKey(null);
    }
  }

  async function doSaveCategorize(reconId: string, bankTxIndex: number) {
    if (categorizeSaving) return;
    // Every type has a category and subcategory now (hidden ones are
    // auto-selected), and the backend requires both on every transaction.
    if (!categorizeCategoryId || (!categorizeIsSplit && !categorizePropertyId)) {
      setCategorizeError("Category and Property are required.");
      return;
    }
    if (!categorizeSubcategoryId) {
      setCategorizeError("Please select sub category to continue.");
      return;
    }
    if (categorizeIsRegularPayment) {
      if (!categorizeDueDate) {
        setCategorizeError("Due date is required.");
        return;
      }
      if (categorizeDueDateError) {
        setCategorizeError(categorizeDueDateError);
        return;
      }
      if (!categorizeAlertName.trim()) {
        setCategorizeError("Alert name is required.");
        return;
      }
    }
    const rec = reconCache.get(reconId);
    const bankTx = rec?.transactions[bankTxIndex];
    if (!bankTx) return;
    setCategorizeError(null);
    setCategorizeSaving(true);
    const grossAmount = bankTx.debit ?? bankTx.credit ?? 0;

    let splits: Array<Record<string, unknown>>;
    if (categorizeIsSplit && allowsBusinessExtras(categorizeType)) {
      const splitPropertyCount = new Set(
        categorizeSplitRows.map((row) => row.propertyId).filter(Boolean)
      ).size;
      if (splitPropertyCount < 2) {
        setCategorizeError("Split transactions must include more than one property.");
        setCategorizeSaving(false);
        return;
      }
      if (Object.keys(categorizeSplitErrors).length > 0) {
        setCategorizeError("Fix the errors in the split rows.");
        setCategorizeSaving(false);
        return;
      }
      if (!categorizeSplitMatches) {
        setCategorizeError(
          `Split amounts must total ${grossAmount.toFixed(
            2,
          )} (currently ${categorizeSplitTotal.toFixed(2)}).`
        );
        setCategorizeSaving(false);
        return;
      }
      splits = categorizeSplitRows.map((r) => {
        const rowAmount = Number.parseFloat(r.amount);
        return {
          property_id: r.propertyId,
          split_percentage: Number(((rowAmount / grossAmount) * 100).toFixed(4)),
          split_gross_amount: Number(rowAmount.toFixed(2)),
        };
      });
    } else {
      const resolvedPropertyId = allowsBusinessExtras(categorizeType)
        ? categorizePropertyId
        : categorizePropertyId || (properties[0]?.id ?? "");
      if (!resolvedPropertyId) {
        setCategorizeError("Property is required.");
        setCategorizeSaving(false);
        return;
      }
      splits = [{ property_id: resolvedPropertyId, split_percentage: 100, split_gross_amount: grossAmount }];
    }

    let gstAmount = 0;
    if (categorizeGst) {
      const parsed = Number.parseFloat(categorizeGstAmount);
      if (!categorizeGstAmount || Number.isNaN(parsed) || parsed < 0) {
        setCategorizeError("GST must be a non-negative number.");
        setCategorizeSaving(false);
        return;
      }
      if (parsed > grossAmount) {
        setCategorizeError("GST amount cannot exceed the transaction amount.");
        setCategorizeSaving(false);
        return;
      }
      gstAmount = parsed;
    }

    try {
      const token = await getFreshToken();

      // Rent alerts only apply to business transactions.
      const withBusinessExtras = allowsBusinessExtras(categorizeType);
      const metadata: Record<string, unknown> = {
        source: "reconciliation_categorized",
        is_regular_payment: withBusinessExtras ? categorizeIsRegularPayment : false,
        due_date: withBusinessExtras && categorizeIsRegularPayment ? (categorizeDueDate || null) : null,
        alert_name: withBusinessExtras && categorizeIsRegularPayment ? (categorizeAlertName.trim() || null) : null,
      };


      const postBody: Record<string, unknown> = {
        type: categorizeType,
        category_id: categorizeCategoryId,
        subcategory_id: categorizeSubcategoryId,
        invoice_date: bankTx.date,
        gross_amount: grossAmount,
        gst_amount: gstAmount,
        description: bankTx.payee ?? bankTx.description ?? null,
        internal_remarks: null,
        // No review_status: creates default to 'active'. The review queue is
        // only for transactions a client submits for sign-off.
        metadata,
        splits,
      };

      // The private-use split is a first-class field. The backend turns it into
      // a business child and a personal child; this drawer only states the
      // percentage. It used to write is_personal / personal_portion into
      // metadata, which nothing read — the private share stayed deductible.
      if (allowsPersonalPortion(categorizeType) && categorizeIsPersonal) {
        if (categorizePersonalError) {
          setCategorizeError(categorizePersonalError);
          return;
        }
        postBody.personal_split = {
          percentage: Number(categorizePersonalPercentage.toFixed(2)),
        };
      }

      // First-class fields since migration 0037 — never metadata. The builder
      // cannot emit a partial draft, so there is nothing to validate here.
      Object.assign(postBody, assetRequestFields(categorizeAssetDraft));

      const txRes = await fetch(`/api/entities/${entityId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(postBody),
      });

      if (!txRes.ok) {
        const body = await txRes.json().catch(() => ({})) as { message?: string };
        setCategorizeError(body.message ?? "Failed to create transaction.");
        return;
      }
      const newTx = await txRes.json() as { id: string };

      const matchRes = await fetch(
        `/api/entities/${entityId}/reconciliations/${reconId}/matches`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ bankTxIndex, transactionId: newTx.id, status: "confirmed" }),
        },
      );
      if (!matchRes.ok) {
        const body = await matchRes.json().catch(() => ({})) as { message?: string };
        setCategorizeError(body.message ?? "Failed to link match.");
        return;
      }

      await reloadMatches();
      const updatedTxRes = await fetch(`/api/entities/${entityId}/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (updatedTxRes.ok) {
        const data = await updatedTxRes.json() as { items?: CoreTransactionListItem[] };
        setEntityTxs(data.items ?? []);
      }
      setCategorizeKey(null);
    } catch {
      setCategorizeError("Something went wrong. Please try again.");
    } finally {
      setCategorizeSaving(false);
    }
  }

  function doExcludeMatch(reconId: string, bankTxIndex: number) {
    const key = mkey(reconId, bankTxIndex);
    const optimistic: ReconciliationMatch = {
      id: "",
      reconciliationId: reconId,
      bankTxIndex,
      transactionId: null,
      status: "excluded",
      confirmedBy: "",
      confirmedAt: new Date().toISOString(),
    };
    startTransition(async () => {
      addOptimisticMatch({ key, match: optimistic });
      try {
        await fetch(
          `/api/entities/${entityId}/reconciliations/${reconId}/matches`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify({ bankTxIndex, transactionId: null, status: "excluded" }),
          },
        );
        await reloadMatches();
        setExpandedKey(null);
      } catch { /* optimistic rolls back */ }
    });
  }

  function openBulkCategorize() {
    if (selectedEligibleRows.length === 0) return;
    const first = selectedEligibleRows[0];
    setBulkType(first.row.debit != null ? "expense" : "revenue");
    setBulkCategoryId(null);
    setBulkSubcategoryId(null);
    setBulkSubcategories([]);
    setBulkPropertyId("");
    setBulkGst(false);
    setBulkIsPersonal(false);
    setBulkPersonalPercentage("");
    setBulkError(null);
    setBulkProgress(null);
    setBulkOpen(true);
  }

  async function doBulkCategorize() {
    if (bulkSaving || bulkExcluding) return;
    if (!bulkPropertyId || !bulkCategoryId) {
      setBulkError("Property and Category are required.");
      return;
    }
    if (!bulkSubcategoryId) {
      setBulkError("Please select sub category to continue.");
      return;
    }
    // Validated once, before any row is written: a bad percentage would
    // otherwise fail every line individually partway through the batch.
    const applyBulkPersonalSplit = allowsPersonalPortion(bulkType) && bulkIsPersonal;
    if (applyBulkPersonalSplit && bulkPersonalError) {
      setBulkError(bulkPersonalError);
      return;
    }
    const bulkPersonalPercentageValue = Number(
      (Number.parseFloat(bulkPersonalPercentage) || 0).toFixed(2),
    );
    const rows = selectedEligibleRows;
    if (rows.length === 0) return;
    setBulkError(null);
    setBulkSaving(true);
    setBulkProgress({ done: 0, total: rows.length });
    const succeededKeys: MatchKey[] = [];
    let failedCount = 0;
    try {
      const token = await getFreshToken();
      for (let i = 0; i < rows.length; i++) {
        const { reconId, bankTxIndex, row } = rows[i];
        const gross = row.debit ?? row.credit ?? 0;
        const gst = bulkGst ? Math.round((gross / 11) * 100) / 100 : 0;
        try {
          const txRes = await fetch(`/api/entities/${entityId}/transactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              type: bulkType,
              category_id: bulkCategoryId,
              subcategory_id: bulkSubcategoryId,
              invoice_date: row.date,
              gross_amount: gross,
              gst_amount: gst,
              description: row.payee ?? row.description ?? null,
              internal_remarks: null,
              is_asset_purchase: false,
              metadata: { source: "reconciliation_categorized" },
              splits: [{ property_id: bulkPropertyId, split_percentage: 100, split_gross_amount: gross }],
              // One percentage across every selected line. Each line's own
              // business and personal amounts are derived by the backend from
              // its own total, so lines of different sizes each split correctly.
              ...(applyBulkPersonalSplit
                ? { personal_split: { percentage: bulkPersonalPercentageValue } }
                : {}),
            }),
          });
          if (!txRes.ok) throw new Error("create failed");
          const newTx = await txRes.json() as { id: string };
          const matchRes = await fetch(
            `/api/entities/${entityId}/reconciliations/${reconId}/matches`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ bankTxIndex, transactionId: newTx.id, status: "confirmed" }),
            },
          );
          if (!matchRes.ok) throw new Error("match failed");
          succeededKeys.push(mkey(reconId, bankTxIndex));
        } catch {
          failedCount += 1;
        }
        setBulkProgress({ done: i + 1, total: rows.length });
      }
      await reloadMatches();
      const updatedTxRes = await fetch(`/api/entities/${entityId}/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (updatedTxRes.ok) {
        const data = await updatedTxRes.json() as { items?: CoreTransactionListItem[] };
        setEntityTxs(data.items ?? []);
      }
      if (succeededKeys.length > 0) {
        setSelectedRowKeys((prev) => {
          const next = new Set(prev);
          succeededKeys.forEach((k) => next.delete(k));
          return next;
        });
      }
      if (failedCount > 0) {
        setBulkError(
          `${failedCount} of ${rows.length} transactions failed to categorize. The rest were saved — please retry the remaining ones.`,
        );
      } else {
        setBulkOpen(false);
      }
    } catch {
      setBulkError("Something went wrong. Please try again.");
    } finally {
      setBulkSaving(false);
      setBulkProgress(null);
    }
  }

  async function doBulkExclude() {
    if (bulkSaving || bulkExcluding) return;
    const rows = selectedEligibleRows;
    if (rows.length === 0) return;
    setBulkError(null);
    setBulkExcluding(true);
    const succeededKeys: MatchKey[] = [];
    let failedCount = 0;
    try {
      const token = await getFreshToken();
      for (const { reconId, bankTxIndex } of rows) {
        try {
          const res = await fetch(
            `/api/entities/${entityId}/reconciliations/${reconId}/matches`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ bankTxIndex, transactionId: null, status: "excluded" }),
            },
          );
          if (!res.ok) throw new Error("exclude failed");
          succeededKeys.push(mkey(reconId, bankTxIndex));
        } catch {
          failedCount += 1;
        }
      }
      await reloadMatches();
      if (succeededKeys.length > 0) {
        setSelectedRowKeys((prev) => {
          const next = new Set(prev);
          succeededKeys.forEach((k) => next.delete(k));
          return next;
        });
      }
      if (failedCount > 0) {
        setBulkError(`${failedCount} of ${rows.length} transactions failed to exclude.`);
      } else {
        setBulkOpen(false);
      }
    } catch {
      setBulkError("Something went wrong. Please try again.");
    } finally {
      setBulkExcluding(false);
    }
  }

  function doUndoMatch(reconId: string, bankTxIndex: number) {
    const key = mkey(reconId, bankTxIndex);
    startTransition(async () => {
      addOptimisticMatch({ remove: key });
      try {
        await fetch(
          `/api/entities/${entityId}/reconciliations/${reconId}/matches?bankTxIndex=${bankTxIndex}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } },
        );
        await reloadMatches();
      } catch { /* optimistic rolls back */ }
    });
  }

  function doBulkUndoExcluded() {
    const rows = selectedExcludedRows;
    if (rows.length === 0) return;
    startTransition(async () => {
      rows.forEach(({ reconId, bankTxIndex }) => {
        addOptimisticMatch({ remove: mkey(reconId, bankTxIndex) });
      });
      try {
        const token = getToken();
        await Promise.all(
          rows.map(({ reconId, bankTxIndex }) =>
            fetch(
              `/api/entities/${entityId}/reconciliations/${reconId}/matches?bankTxIndex=${bankTxIndex}`,
              { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
            ).catch(() => {})
          )
        );
        await reloadMatches();
        setSelectedRowKeys((prev) => {
          const next = new Set(prev);
          rows.forEach(({ reconId, bankTxIndex }) => {
            next.delete(mkey(reconId, bankTxIndex));
          });
          return next;
        });
      } catch { /* optimistic rolls back */ }
    });
  }

  // ── Statements panel helpers ─────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelectedHistoryIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
    setReconPage(1);
  }

  function uploadStageLabel(): string {
    if (uploadStage.type === "uploading") return `Uploading… ${uploadStage.progress}%`;
    if (uploadStage.type === "starting") return "Starting extraction…";
    if (uploadStage.type === "streaming") {
      const m: Record<string, string> = {
        downloading: "Downloading statement…",
        splitting: "Splitting pages…",
        parsing: "Parsing CSV…",
        extracting: `Extracting transactions… (${uploadStage.pagesDone}/${uploadStage.pagesTotal} pages, ${uploadStage.txSoFar} found)`,
      };
      return m[uploadStage.stage] ?? uploadStage.stage;
    }
    return "";
  }

  const isProcessing =
    uploadStage.type === "uploading" ||
    uploadStage.type === "starting" ||
    uploadStage.type === "streaming";

  const processingPct =
    uploadStage.type === "uploading"
      ? uploadStage.progress
      : uploadStage.type === "streaming" && uploadStage.pagesTotal > 0
        ? Math.round((uploadStage.pagesDone / uploadStage.pagesTotal) * 100)
        : uploadStage.type === "starting" ? 95 : 0;

  const candidateMatches = computeCandidateMatches(combinedRows, deferredEntityTxs);
  const reconciledCount = Array.from(optimisticMatches.values()).filter((m) => m.status === "confirmed").length;
  const excludedCount = Array.from(optimisticMatches.values()).filter((m) => m.status === "excluded").length;

  const excludedRows = useMemo(
    () =>
      combinedRows.filter(
        ({ reconId, bankTxIndex }) =>
          optimisticMatches.get(mkey(reconId, bankTxIndex))?.status === "excluded",
      ),
    [combinedRows, optimisticMatches],
  );

  const exportReconCsv = useCallback((rows: CombinedRow[], filename: string) => {
    if (rows.length === 0) return;
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const headers = ["statement", "date", "payee", "description", "debit", "credit", "balance", "status"];
    const csv = [
      headers.join(","),
      ...rows.map(({ reconId, statementLabel, bankTxIndex, row }) => {
        const m = optimisticMatches.get(mkey(reconId, bankTxIndex));
        return [
          esc(statementLabel),
          row.date,
          esc(row.payee ?? ""),
          esc(row.description),
          row.debit ?? "",
          row.credit ?? "",
          row.balance ?? "",
          m?.status ?? "unreconciled",
        ].join(",");
      }),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = filename;
    a.click();
  }, [optimisticMatches]);

  // CSV statements report data rows the backend could not parse; surface them
  // so the accountant knows those transactions are missing from the table.
  const skippedRowNotices = statements
    .filter((s) => (s.summary?.skippedRows?.length ?? 0) > 0)
    .map((s) => {
      const cached = reconCache.get(s.id);
      const date = new Date(s.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
      return {
        id: s.id,
        label: cached ? statementLabelFor(cached) : `Statement · ${date}`,
        rows: s.summary?.skippedRows ?? [],
      };
    });

  const getRowPropertyName = useCallback((reconId: string, bankTxIndex: number): string => {
    const key = mkey(reconId, bankTxIndex);
    const matchEntry = optimisticMatches.get(key);
    const isConfirmed = matchEntry?.status === "confirmed";
    if (isConfirmed && matchEntry?.transactionId) {
      const matchedTx = entityTxs.find((t) => t.id === matchEntry.transactionId);
      if (matchedTx?.propertyNames?.[0]) {
        return matchedTx.propertyNames[0];
      }
    }
    const propId = assignedProperties.get(key);
    if (propId) {
      const p = properties.find((x) => x.id === propId);
      if (p) return p.name;
    }
    return "";
  }, [optimisticMatches, entityTxs, assignedProperties, properties]);

  const getRowCategoryName = useCallback((reconId: string, bankTxIndex: number): string => {
    const key = mkey(reconId, bankTxIndex);
    const matchEntry = optimisticMatches.get(key);
    const isConfirmed = matchEntry?.status === "confirmed";
    if (isConfirmed && matchEntry?.transactionId) {
      const matchedTx = entityTxs.find((t) => t.id === matchEntry.transactionId);
      if (matchedTx?.categoryName) return matchedTx.categoryName;
    }
    const isExcluded = matchEntry?.status === "excluded";
    if (isExcluded) return "Excluded";
    const candidates = candidateMatches.get(key) ?? [];
    if (candidates.length > 0) return candidates[0].categoryName;
    return "";
  }, [optimisticMatches, entityTxs, candidateMatches]);

  const latestTxDate = useMemo(() => {
    let max = 0;
    for (const { row } of combinedRows) {
      const t = new Date(row.date).getTime();
      if (!isNaN(t) && t > max) max = t;
    }
    return max > 0 ? max : new Date().getTime();
  }, [combinedRows]);

  const q = query.trim().toLowerCase();

  const visibleRows = combinedRows
    .filter(({ reconId, bankTxIndex, row, statementLabel }) => {
      const key = mkey(reconId, bankTxIndex);
      const match = optimisticMatches.get(key);
      const isResolved = match != null;
      const isConfirmed = match?.status === "confirmed";
      const isExcluded = match?.status === "excluded";

      if (activeTab === "reviewed" && !isConfirmed) return false;
      if (activeTab === "excluded" && !isExcluded) return false;

      if (past30DaysOnly) {
        const txTime = new Date(row.date).getTime();
        if (!isNaN(txTime)) {
          const now = new Date().getTime();
          const anchor = (now - latestTxDate > 90 * 24 * 60 * 60 * 1000) ? latestTxDate : now;
          const thirtyDaysAgo = anchor - 30 * 24 * 60 * 60 * 1000;
          if (txTime < thirtyDaysAgo) return false;
        }
      }

      const matchedTx = isConfirmed && match?.transactionId
        ? entityTxs.find((t) => t.id === match.transactionId) ?? null
        : null;

      const isCategorized = isConfirmed
        ? (matchedTx ? (matchedTx.metadata?.source === "reconciliation_categorized" || matchedTx.metadata?.categorized === true) : !candidateMatches.has(key))
        : !candidateMatches.has(key);

      const isMatched = isConfirmed
        ? (matchedTx ? !(matchedTx.metadata?.source === "reconciliation_categorized" || matchedTx.metadata?.categorized === true) : candidateMatches.has(key))
        : candidateMatches.has(key);

      if (filter === "matched" && !isMatched) return false;
      if (filter === "categorized" && !isCategorized) return false;

      if (activeTab === "unreviewed") {
        if (isResolved) {
          if (filter === "matched" && isConfirmed && isMatched) {
            // keep
          } else if (filter === "categorized" && isConfirmed && isCategorized) {
            // keep
          } else {
            return false;
          }
        }
      }
      if (
        q &&
        !row.description.toLowerCase().includes(q) &&
        !(row.payee?.toLowerCase().includes(q) ?? false) &&
        !statementLabel.toLowerCase().includes(q)
      ) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortField === "date") {
        const at = new Date(a.row.date).getTime();
        const bt = new Date(b.row.date).getTime();
        if (isNaN(at) && isNaN(bt)) return 0;
        if (isNaN(at)) return 1;
        if (isNaN(bt)) return -1;
        return sortDirection === "desc" ? bt - at : at - bt;
      }
      if (sortField === "payee") {
        const valA = (a.row.payee ?? a.row.description ?? "").toLowerCase();
        const valB = (b.row.payee ?? b.row.description ?? "").toLowerCase();
        return sortDirection === "desc" ? valB.localeCompare(valA) : valA.localeCompare(valB);
      }
      if (sortField === "statement") {
        const valA = a.statementLabel.toLowerCase();
        const valB = b.statementLabel.toLowerCase();
        return sortDirection === "desc" ? valB.localeCompare(valA) : valA.localeCompare(valB);
      }
      if (sortField === "property") {
        const valA = getRowPropertyName(a.reconId, a.bankTxIndex).toLowerCase();
        const valB = getRowPropertyName(b.reconId, b.bankTxIndex).toLowerCase();
        if (!valA && !valB) return 0;
        if (!valA) return 1;
        if (!valB) return -1;
        return sortDirection === "desc" ? valB.localeCompare(valA) : valA.localeCompare(valB);
      }
      if (sortField === "category") {
        const valA = getRowCategoryName(a.reconId, a.bankTxIndex).toLowerCase();
        const valB = getRowCategoryName(b.reconId, b.bankTxIndex).toLowerCase();
        if (!valA && !valB) return 0;
        if (!valA) return 1;
        if (!valB) return -1;
        return sortDirection === "desc" ? valB.localeCompare(valA) : valA.localeCompare(valB);
      }
      if (sortField === "expense") {
        const valA = a.row.debit;
        const valB = b.row.debit;
        if (valA == null && valB == null) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;
        return sortDirection === "desc" ? valB - valA : valA - valB;
      }
      if (sortField === "income") {
        const valA = a.row.credit;
        const valB = b.row.credit;
        if (valA == null && valB == null) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;
        return sortDirection === "desc" ? valB - valA : valA - valB;
      }
      return 0;
    });

  const totalItems = visibleRows.length;
  const numericPageSize = pageSize === "all" ? totalItems : Number(pageSize);
  const reconTotalPages = Math.ceil(totalItems / numericPageSize) || 1;
  const activePage = Math.min(reconPage, reconTotalPages);

  const pagedReconRows = useMemo(() => {
    const startIndex = (activePage - 1) * numericPageSize;
    const endIndex = startIndex + numericPageSize;
    return visibleRows.slice(startIndex, endIndex);
  }, [visibleRows, activePage, numericPageSize]);

  const selectableRowsOnPage = useMemo(() => {
    return pagedReconRows.filter((row) => {
      const key = mkey(row.reconId, row.bankTxIndex);
      const candidates = candidateMatches.get(key) ?? [];
      const isConfirmed = optimisticMatches.get(key)?.status === "confirmed";
      const isExcluded = optimisticMatches.get(key)?.status === "excluded";
      if (activeTab === "excluded") {
        return isExcluded && !isSessionCompleted;
      }
      const isEligible = !isConfirmed && !isExcluded && candidates.length === 0 && !isSessionCompleted;
      if (!isEligible) return false;
      if (selectedType) {
        const rowType = row.row.credit != null ? "revenue" : "expense";
        return rowType === selectedType;
      }
      return true;
    });
  }, [pagedReconRows, candidateMatches, optimisticMatches, isSessionCompleted, selectedType, activeTab]);

  const unreviewedCount = combinedRows.length - reconciledCount - excludedCount;

  // ── Render ────────────────────────────────────────────────────────────────

  if (sessionLoading) {
    return <AccountantReconciliationSkeleton hasActiveRecon />;
  }

  if (sessionError || !session) {
    return (
      <section className="accountant-reconciliation-page">
        <Link
          href={`/dashboard/accountant/clients/${clientId}/entities/${entityId}?tab=reconciliation`}
          className="accountant-back-link"
        >
          ← Back to Entity
        </Link>
        <div className="accountant-document-empty-state" style={{ marginTop: 24 }}>
          <DocumentIcon />
          <strong>{sessionError ?? "Session not found."}</strong>
        </div>
      </section>
    );
  }

  const sessionPeriod = session.periodFrom && session.periodTo
    ? `${session.periodFrom} → ${session.periodTo}`
    : session.periodFrom || session.periodTo || "";

  return (
    <section className="accountant-reconciliation-page">
      <Link
        href={`/dashboard/accountant/clients/${clientId}/entities/${entityId}?tab=reconciliation`}
        className="accountant-back-link"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
          <path d="M9 12h10" />
        </svg>
        Back to Entity
      </Link>

      <div className="accountant-reconciliation-title">
        <div>
          <h1>{session.label}</h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
            {sessionPeriod && <>{sessionPeriod} · </>}
            <span style={{
              fontWeight: 600,
              color: isSessionCompleted ? "var(--color-success, #16a34a)" : "var(--color-warning, #ca8a04)",
              textTransform: "capitalize",
            }}>{session.status}</span>
            {" · "}
            {statements.length} statement{statements.length === 1 ? "" : "s"}
          </p>
        </div>
        {!isSessionCompleted ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              type="button"
              onClick={downloadSampleCsv}
              style={{ background: "none", border: "none", padding: 0, color: "#2563eb", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}
            >
              Download CSV template
            </button>
            <button
              type="button"
              className="accountant-reconciliation-upload-button"
              onClick={() => fileRef.current?.click()}
              disabled={isProcessing}
            >
              <UploadIcon />
              Upload Statement
            </button>
          </div>
        ) : (
          // A completed session's header was empty. The ledger is the thing an
          // accountant wants next, and it is only reachable once the status is
          // completed — so this is where it belongs.
          <Link
            className="accountant-reconciliation-upload-button"
            href={`/dashboard/accountant/clients/${clientId}/entities/${entityId}/reconciliation/${sessionId}/ledger`}
            style={{ textDecoration: "none" }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
            </svg>
            View Ledger
          </Link>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.csv"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
      </div>

      {/* ── Statements panel (always visible) ──────────────────────────── */}
      <section className="accountant-uploaded-statements-card">
        <div className="accountant-existing-documents-head">
          <div>
            <h2>Bank Statements in this Reconciliation</h2>
            <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
              Select one or more to view their transactions below.
            </p>
          </div>
          {selectedHistoryIds.length > 0 && (
            <span>{selectedHistoryIds.length} selected</span>
          )}
        </div>

        {isProcessing && (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb" }}>
            <p style={{ fontSize: 13, color: "#4b5563", margin: "0 0 8px" }}>{uploadStageLabel()}</p>
            <div style={{ background: "#e5e7eb", borderRadius: 9999, height: 8 }}>
              <div style={{ background: "#3b82f6", borderRadius: 9999, height: 8, width: `${processingPct}%`, transition: "width 0.3s" }} />
            </div>
          </div>
        )}
        {uploadStage.type === "error" && (
          <div style={{ padding: "10px 16px", color: "#dc2626", fontSize: 13, borderBottom: "1px solid #e5e7eb" }}>
            {uploadStage.message}
          </div>
        )}
        {skippedRowNotices.length > 0 && (
          <div style={{ padding: "10px 16px", background: "#fffbeb", borderBottom: "1px solid #fde68a", color: "#92400e", fontSize: 13 }}>
            {skippedRowNotices.map(({ id, label, rows }) => (
              <details key={id} style={{ margin: "2px 0" }}>
                <summary style={{ cursor: "pointer" }}>
                  {rows.length} row{rows.length === 1 ? "" : "s"} in {label} could not be parsed and {rows.length === 1 ? "was" : "were"} skipped
                </summary>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {rows.map((r) => (
                    <li key={`${id}-${r.line}`}>Line {r.line}: {r.reason}</li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}

        {statements.length === 0 ? (
          <div
            className={`accountant-document-empty-state${isDragging ? " is-dragging" : ""}`}
            onDragOver={(e) => {
              if (isSessionCompleted || isProcessing) return;
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              if (isSessionCompleted || isProcessing) return;
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            onMouseEnter={() => {
              if (!isSessionCompleted && !isProcessing) setIsHovered(true);
            }}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => {
              if (!isSessionCompleted && !isProcessing) {
                fileRef.current?.click();
              }
            }}
            style={{
              transition: "all 0.2s ease-in-out",
              borderColor: isDragging ? "#2563eb" : (isHovered ? "#3b82f6" : undefined),
              background: isDragging ? "#f5f8ff" : (isHovered ? "#fafcff" : undefined),
              boxShadow: isDragging ? "0 0 0 4px rgba(37, 99, 235, 0.08)" : undefined,
              cursor: (!isSessionCompleted && !isProcessing) ? "pointer" : "default"
            }}
          >
            <div style={{ pointerEvents: isDragging ? "none" : "auto", display: "grid", placeItems: "center" }}>
              <div
                className="upload-icon-circle"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: isDragging ? "#2563eb" : "#ebf2fe",
                  color: isDragging ? "#ffffff" : "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                  marginBottom: 12,
                  boxShadow: isDragging ? "none" : "0 2px 8px rgba(37, 99, 235, 0.12)",
                  border: isDragging ? "none" : "1px solid rgba(37, 99, 235, 0.15)"
                }}
              >
                <UploadIcon width={22} height={22} />
              </div>
              <strong style={{ margin: "14px 0 0", color: "#101828", fontSize: "17px" }}>Drag and drop your statement here</strong>
              <p style={{ color: "#4b5563", fontSize: 14, marginTop: 4, marginBottom: 12 }}>
                or <span style={{ color: "#2563eb", fontWeight: 600, textDecoration: "underline" }}>browse files</span> to upload a PDF or CSV bank statement
              </p>
            </div>
            {!isSessionCompleted && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadSampleCsv();
                }}
                style={{
                  marginTop: 8,
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#2563eb",
                  fontSize: 13,
                  cursor: "pointer",
                  textDecoration: "underline",
                  pointerEvents: isDragging ? "none" : "auto",
                  zIndex: 2
                }}
              >
                Download CSV template
              </button>
            )}
          </div>
        ) : (
          <div className="accountant-document-select-list">
            {statements.map((item) => {
              const selected = selectedHistoryIds.includes(item.id);
              const loading = reconLoadingIds.has(item.id);
              const date = new Date(item.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
              const txCount = item.summary?.totalTransactions ?? "—";
              const pages = item.totalPages ? `${item.totalPages} pages` : "";
              const cached = reconCache.get(item.id);
              const label = cached ? statementLabelFor(cached) : `Bank Statement · ${date}`;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={selected ? "is-selected" : ""}
                  onClick={() => toggleSelect(item.id)}
                  disabled={loading}
                >
                  <span className="accountant-checkbox-fake">{selected ? "✓" : ""}</span>
                  <DocumentIcon />
                  <strong>
                    {label}
                    <em>
                      {txCount} transactions{pages ? ` · ${pages}` : ""}{` · ${item.status}`}
                      {loading ? " · Loading…" : ""}
                    </em>
                  </strong>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {feedbackMessage && (
        <div className="accountant-reconciliation-feedback" role="status">{feedbackMessage}</div>
      )}

      {/* ── KPI cards (aggregated across selected statements) ──────────── */}
      <div className="accountant-reconciliation-kpis">
        <article>
          <div><span>Total Debits</span></div>
          <strong>{fmtAud(aggregatedSummary.totalDebits)}</strong>
          <small>{selectedRecons.length === 1 && selectedRecons[0].account
            ? `Opening: ${fmtAud(selectedRecons[0].account.openingBalance)}`
            : `${selectedRecons.length} statement${selectedRecons.length === 1 ? "" : "s"} selected`}</small>
        </article>
        <article>
          <span>Transactions</span>
          <strong>{combinedRows.length}</strong>
          <small>
            {selectedRecons.length === 1 && selectedRecons[0].totalPages
              ? `${selectedRecons[0].totalPages - (selectedRecons[0].summary?.pagesSkipped ?? 0)} pages processed`
              : ""}
          </small>
        </article>
        <article>
          <span>Total Credits</span>
          <strong className="is-good-text">{fmtAud(aggregatedSummary.totalCredits)}</strong>
          <small>{selectedRecons.length === 1 && selectedRecons[0].account
            ? `Closing: ${fmtAud(selectedRecons[0].account.closingBalance)}`
            : ""}</small>
        </article>
        <article className="recon-kpi-reconciled">
          <span>Reconciled</span>
          <strong>
            {matchesLoading
              ? <span className="recon-shimmer" style={{ width: 40, height: 28, display: "inline-block" }} />
              : `${reconciledCount} / ${combinedRows.length}`}
          </strong>
          <small>{excludedCount > 0 ? `${excludedCount} excluded` : "Confirm matches below"}</small>
        </article>
      </div>

      <div className="accountant-reconciliation-main-card">
        {/* ── Filter / tab bar ─────────────────────────────────────────── */}
        <section className="accountant-reconciliation-filter-card">
          <div className="accountant-reconciliation-tabs">
            <button
              type="button"
              className={activeTab === "unreviewed" ? "is-active" : ""}
              onClick={() => { setActiveTab("unreviewed"); setFilter("all"); setReconPage(1); }}
            >
              Unreviewed ({unreviewedCount})
            </button>
            <button
              type="button"
              className={activeTab === "reviewed" ? "is-active" : ""}
              onClick={() => { setActiveTab("reviewed"); setFilter("all"); setReconPage(1); }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Reviewed ({reconciledCount})
                <span className="accountant-info-icon" onClick={(e) => e.stopPropagation()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '13px', height: '13px', display: 'block' }}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                  <span className="accountant-info-tooltip is-bottom">
                    Transactions that are matched or categorised and are ready for reconciliation.
                  </span>
                </span>
              </span>
            </button>
            <button
              type="button"
              className={activeTab === "excluded" ? "is-active" : ""}
              onClick={() => { setActiveTab("excluded"); setFilter("all"); setReconPage(1); }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Excluded ({excludedCount})
                <span className="accountant-info-icon" onClick={(e) => e.stopPropagation()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '13px', height: '13px', display: 'block' }}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                  <span className="accountant-info-tooltip is-bottom">
                    Transactions that don&apos;t belong to the selected entity and have been excluded from reconciliation.
                  </span>
                </span>
              </span>
            </button>
          </div>
          <div className="accountant-reconciliation-controls">
            <label className="accountant-reconciliation-search">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m16 16 4 4" />
              </svg>
              <input
                type="text"
                placeholder="Search by payee or reference..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setReconPage(1); }}
              />
            </label>
            <div className="accountant-reconciliation-center-group">
              <div className="accountant-reconciliation-segmented">
                <button
                  type="button"
                  className={filter === "all" ? "is-active" : ""}
                  onClick={() => { setFilter("all"); setReconPage(1); }}
                >
                  {activeTab === "reviewed" ? "All Reviewed" : "All"}
                </button>
                <button
                  type="button"
                  className={filter === "matched" ? "is-active" : ""}
                  onClick={() => { setFilter("matched"); setReconPage(1); }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {activeTab === "reviewed" ? "Matched Only" : "Matched"}
                    <span className="accountant-info-icon" onClick={(e) => e.stopPropagation()}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '13px', height: '13px', display: 'block' }}>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4" />
                        <path d="M12 8h.01" />
                      </svg>
                      <span className="accountant-info-tooltip is-bottom">
                        Bank transactions matched with manually added transactions. Confirm the match to move them to Reviewed.
                      </span>
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className={filter === "categorized" ? "is-active" : ""}
                  onClick={() => { setFilter("categorized"); setReconPage(1); }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {activeTab === "reviewed" ? "Categorized Only" : "Categorized"}
                    <span className="accountant-info-icon" onClick={(e) => e.stopPropagation()}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '13px', height: '13px', display: 'block' }}>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4" />
                        <path d="M12 8h.01" />
                      </svg>
                      <span className="accountant-info-tooltip is-bottom">
                        Transactions assigned to a category for the selected entity. Review and confirm them before reconciliation.
                      </span>
                    </span>
                  </span>
                </button>
              </div>
              <button
                type="button"
                className={`accountant-reconciliation-date-filter${past30DaysOnly ? " is-active" : ""}`}
                onClick={() => { setPast30DaysOnly((cur) => !cur); setReconPage(1); }}
              >
                Past 30 Days
              </button>
            </div>
            <button
              type="button"
              className={`accountant-reconciliation-sort${sortField === "date" ? " is-active" : ""}`}
              onClick={() => {
                setSortField("date");
                setSortDirection((cur) => (cur === "desc" ? "asc" : "desc"));
                setReconPage(1);
              }}
            >
              Sort: Date
              <svg viewBox="0 0 24 24" aria-hidden="true" className="sort-chevron">
                <path d={sortField === "date" && sortDirection === "desc" ? "m6 9 6 6 6-6" : "m6 15 6-6 6 6"} />
              </svg>
            </button>
            {activeTab === "excluded" && (
              <button
                type="button"
                className="accountant-reconciliation-sort"
                disabled={excludedRows.length === 0}
                title="Download every excluded transaction as CSV"
                onClick={() => exportReconCsv(excludedRows, `reconciliation-${session.id}-excluded.csv`)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="sort-chevron">
                  <path d="M12 3v12" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
                Export Excluded
              </button>
            )}
          </div>
        </section>

        {/* ── Bulk action bar ────────────────────────────────────────────── */}
        {selectedEligibleRows.length > 0 && !isSessionCompleted && (
          <div className="recon-bulk-bar mx-4 my-4" role="toolbar" aria-label="Bulk actions">
            <span className="recon-bulk-bar-count">
              {selectedEligibleRows.length} transaction{selectedEligibleRows.length > 1 ? "s" : ""} selected
            </span>
            <div className="recon-bulk-bar-actions">
              <button
                type="button"
                className="recon-bulk-clear-btn"
                onClick={() => setSelectedRowKeys(new Set())}
              >
                Clear
              </button>
              <button
                type="button"
                className="recon-bulk-categorize-btn"
                onClick={openBulkCategorize}
              >
                Categorize
              </button>
            </div>
          </div>
        )}

        {/* ── Bulk action bar for Excluded ── */}
        {activeTab === "excluded" && selectedExcludedRows.length > 0 && !isSessionCompleted && (
          <div className="recon-bulk-bar mx-4 my-4" role="toolbar" aria-label="Bulk actions">
            <span className="recon-bulk-bar-count">
              {selectedExcludedRows.length} transaction{selectedExcludedRows.length > 1 ? "s" : ""} selected
            </span>
            <div className="recon-bulk-bar-actions">
              <button
                type="button"
                className="recon-bulk-clear-btn"
                onClick={() => setSelectedRowKeys(new Set())}
              >
                Clear
              </button>
              <button
                type="button"
                className="recon-bulk-categorize-btn"
                disabled={isPending}
                onClick={doBulkUndoExcluded}
              >
                Undo Exclude
              </button>
            </div>
          </div>
        )}

        {/* ── Combined transaction table ─────────────────────────────────── */}
        <section className="accountant-reconciliation-table">
          <div className="accountant-reconciliation-table-head">
            <span className="custom-recon-checkbox-wrapper" style={{ gridColumn: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {selectableRowsOnPage.length > 0 ? (
                <input
                  type="checkbox"
                  className="custom-recon-checkbox"
                  checked={selectableRowsOnPage.every(row => selectedRowKeys.has(mkey(row.reconId, row.bankTxIndex)))}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSelectedRowKeys((prev) => {
                      const next = new Set(prev);
                      if (checked) {
                        if (activeTab === "excluded") {
                          selectableRowsOnPage.forEach((row) => {
                            next.add(mkey(row.reconId, row.bankTxIndex));
                          });
                        } else {
                          let typeToSelect = selectedType;
                          if (!typeToSelect) {
                            const firstEligible = pagedReconRows.find((row) => {
                              const key = mkey(row.reconId, row.bankTxIndex);
                              const candidates = candidateMatches.get(key) ?? [];
                              const isConfirmed = optimisticMatches.get(key)?.status === "confirmed";
                              const isExcluded = optimisticMatches.get(key)?.status === "excluded";
                              return !isConfirmed && !isExcluded && candidates.length === 0 && !isSessionCompleted;
                            });
                            if (firstEligible) {
                              typeToSelect = firstEligible.row.credit != null ? "revenue" : "expense";
                            }
                          }
                          pagedReconRows.forEach((row) => {
                            const key = mkey(row.reconId, row.bankTxIndex);
                            const candidates = candidateMatches.get(key) ?? [];
                            const isConfirmed = optimisticMatches.get(key)?.status === "confirmed";
                            const isExcluded = optimisticMatches.get(key)?.status === "excluded";
                            const isEligible = !isConfirmed && !isExcluded && candidates.length === 0 && !isSessionCompleted;
                            if (isEligible) {
                              const rowType = row.row.credit != null ? "revenue" : "expense";
                              if (rowType === typeToSelect) {
                                next.add(key);
                              }
                            }
                          });
                        }
                      } else {
                        selectableRowsOnPage.forEach((row) => {
                          next.delete(mkey(row.reconId, row.bankTxIndex));
                        });
                      }
                      return next;
                    });
                  }}
                />
              ) : (
                <div style={{ width: "16px", height: "16px" }} />
              )}
            </span>
            <span
              className={`sortable-header${sortField === "payee" || sortField === "date" ? " active-sort" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setOpenSortDropdown(openSortDropdown === "date_payee" ? null : "date_payee");
              }}
              style={{ gridColumn: 2 }}
            >
              Date &amp; Payee
              <span className="sort-icon-wrapper" style={{ opacity: sortField === "payee" || sortField === "date" ? 1 : 0.45 }}>
                {sortField === "payee" || sortField === "date" ? (
                  sortDirection === "asc" ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  )
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 15l5 5 5-5M7 9l5-5 5 5" /></svg>
                )}
              </span>
              {openSortDropdown === "date_payee" && (
                <div className="sort-dropdown-menu">
                  <button
                    type="button"
                    className={sortField === "date" && sortDirection === "desc" ? "dropdown-active" : ""}
                    onClick={(e) => { e.stopPropagation(); setSortField("date"); setSortDirection("desc"); setOpenSortDropdown(null); setReconPage(1); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                    Sort Date: Newest
                    {sortField === "date" && sortDirection === "desc" && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: '#e04f1a' }}><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className={sortField === "date" && sortDirection === "asc" ? "dropdown-active" : ""}
                    onClick={(e) => { e.stopPropagation(); setSortField("date"); setSortDirection("asc"); setOpenSortDropdown(null); setReconPage(1); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                    Sort Date: Oldest
                    {sortField === "date" && sortDirection === "asc" && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: '#e04f1a' }}><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className={sortField === "payee" && sortDirection === "asc" ? "dropdown-active" : ""}
                    onClick={(e) => { e.stopPropagation(); setSortField("payee"); setSortDirection("asc"); setOpenSortDropdown(null); setReconPage(1); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                    Sort A to Z
                    {sortField === "payee" && sortDirection === "asc" && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: '#e04f1a' }}><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className={sortField === "payee" && sortDirection === "desc" ? "dropdown-active" : ""}
                    onClick={(e) => { e.stopPropagation(); setSortField("payee"); setSortDirection("desc"); setOpenSortDropdown(null); setReconPage(1); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                    Sort Z to A
                    {sortField === "payee" && sortDirection === "desc" && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: '#e04f1a' }}><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                  <div className="sort-dropdown-divider" />
                  <button type="button" onClick={(e) => { e.stopPropagation(); setSortField("date"); setSortDirection("desc"); setOpenSortDropdown(null); setReconPage(1); }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><polyline points="3 3 3 8 8 8" /></svg>
                    Clear sorting
                  </button>
                </div>
              )}
            </span>

            <span
              className={`sortable-header${sortField === "statement" ? " active-sort" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setOpenSortDropdown(openSortDropdown === "statement" ? null : "statement");
              }}
            >
              Statement
              <span className="sort-icon-wrapper" style={{ opacity: sortField === "statement" ? 1 : 0.45 }}>
                {sortField === "statement" ? (
                  sortDirection === "asc" ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  )
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 15l5 5 5-5M7 9l5-5 5 5" /></svg>
                )}
              </span>
              {openSortDropdown === "statement" && (
                <div className="sort-dropdown-menu">
                  <button
                    type="button"
                    className={sortField === "statement" && sortDirection === "asc" ? "dropdown-active" : ""}
                    onClick={(e) => { e.stopPropagation(); setSortField("statement"); setSortDirection("asc"); setOpenSortDropdown(null); setReconPage(1); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                    Sort A to Z
                    {sortField === "statement" && sortDirection === "asc" && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: '#e04f1a' }}><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className={sortField === "statement" && sortDirection === "desc" ? "dropdown-active" : ""}
                    onClick={(e) => { e.stopPropagation(); setSortField("statement"); setSortDirection("desc"); setOpenSortDropdown(null); setReconPage(1); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                    Sort Z to A
                    {sortField === "statement" && sortDirection === "desc" && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: '#e04f1a' }}><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                  <div className="sort-dropdown-divider" />
                  <button type="button" onClick={(e) => { e.stopPropagation(); setSortField("date"); setSortDirection("desc"); setOpenSortDropdown(null); setReconPage(1); }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><polyline points="3 3 3 8 8 8" /></svg>
                    Clear sorting
                  </button>
                </div>
              )}
            </span>

            <span
              className={`sortable-header${sortField === "property" ? " active-sort" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setOpenSortDropdown(openSortDropdown === "property" ? null : "property");
              }}
            >
              Property
              <span className="sort-icon-wrapper" style={{ opacity: sortField === "property" ? 1 : 0.45 }}>
                {sortField === "property" ? (
                  sortDirection === "asc" ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  )
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 15l5 5 5-5M7 9l5-5 5 5" /></svg>
                )}
              </span>
              {openSortDropdown === "property" && (
                <div className="sort-dropdown-menu">
                  <button
                    type="button"
                    className={sortField === "property" && sortDirection === "asc" ? "dropdown-active" : ""}
                    onClick={(e) => { e.stopPropagation(); setSortField("property"); setSortDirection("asc"); setOpenSortDropdown(null); setReconPage(1); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                    Sort A to Z
                    {sortField === "property" && sortDirection === "asc" && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: '#e04f1a' }}><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className={sortField === "property" && sortDirection === "desc" ? "dropdown-active" : ""}
                    onClick={(e) => { e.stopPropagation(); setSortField("property"); setSortDirection("desc"); setOpenSortDropdown(null); setReconPage(1); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                    Sort Z to A
                    {sortField === "property" && sortDirection === "desc" && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: '#e04f1a' }}><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                  <div className="sort-dropdown-divider" />
                  <button type="button" onClick={(e) => { e.stopPropagation(); setSortField("date"); setSortDirection("desc"); setOpenSortDropdown(null); setReconPage(1); }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><polyline points="3 3 3 8 8 8" /></svg>
                    Clear sorting
                  </button>
                </div>
              )}
            </span>

            <span
              className={`sortable-header${sortField === "category" ? " active-sort" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setOpenSortDropdown(openSortDropdown === "category" ? null : "category");
              }}
            >
              Category
              <span className="sort-icon-wrapper" style={{ opacity: sortField === "category" ? 1 : 0.45 }}>
                {sortField === "category" ? (
                  sortDirection === "asc" ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  )
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 15l5 5 5-5M7 9l5-5 5 5" /></svg>
                )}
              </span>
              {openSortDropdown === "category" && (
                <div className="sort-dropdown-menu">
                  <button
                    type="button"
                    className={sortField === "category" && sortDirection === "asc" ? "dropdown-active" : ""}
                    onClick={(e) => { e.stopPropagation(); setSortField("category"); setSortDirection("asc"); setOpenSortDropdown(null); setReconPage(1); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                    Sort A to Z
                    {sortField === "category" && sortDirection === "asc" && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: '#e04f1a' }}><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className={sortField === "category" && sortDirection === "desc" ? "dropdown-active" : ""}
                    onClick={(e) => { e.stopPropagation(); setSortField("category"); setSortDirection("desc"); setOpenSortDropdown(null); setReconPage(1); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                    Sort Z to A
                    {sortField === "category" && sortDirection === "desc" && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: '#e04f1a' }}><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                  <div className="sort-dropdown-divider" />
                  <button type="button" onClick={(e) => { e.stopPropagation(); setSortField("date"); setSortDirection("desc"); setOpenSortDropdown(null); setReconPage(1); }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><polyline points="3 3 3 8 8 8" /></svg>
                    Clear sorting
                  </button>
                </div>
              )}
            </span>

            <span
              className={`sortable-header${sortField === "expense" ? " active-sort" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setOpenSortDropdown(openSortDropdown === "expense" ? null : "expense");
              }}
            >
              Expense
              <span className="sort-icon-wrapper" style={{ opacity: sortField === "expense" ? 1 : 0.45 }}>
                {sortField === "expense" ? (
                  sortDirection === "asc" ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  )
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 15l5 5 5-5M7 9l5-5 5 5" /></svg>
                )}
              </span>
              {openSortDropdown === "expense" && (
                <div className="sort-dropdown-menu">
                  <button
                    type="button"
                    className={sortField === "expense" && sortDirection === "desc" ? "dropdown-active" : ""}
                    onClick={(e) => { e.stopPropagation(); setSortField("expense"); setSortDirection("desc"); setOpenSortDropdown(null); setReconPage(1); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                    Sort High to Low
                    {sortField === "expense" && sortDirection === "desc" && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: '#e04f1a' }}><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className={sortField === "expense" && sortDirection === "asc" ? "dropdown-active" : ""}
                    onClick={(e) => { e.stopPropagation(); setSortField("expense"); setSortDirection("asc"); setOpenSortDropdown(null); setReconPage(1); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                    Sort Low to High
                    {sortField === "expense" && sortDirection === "asc" && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: '#e04f1a' }}><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                  <div className="sort-dropdown-divider" />
                  <button type="button" onClick={(e) => { e.stopPropagation(); setSortField("date"); setSortDirection("desc"); setOpenSortDropdown(null); setReconPage(1); }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><polyline points="3 3 3 8 8 8" /></svg>
                    Clear sorting
                  </button>
                </div>
              )}
            </span>

            <span
              className={`sortable-header${sortField === "income" ? " active-sort" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setOpenSortDropdown(openSortDropdown === "income" ? null : "income");
              }}
            >
              Income
              <span className="sort-icon-wrapper" style={{ opacity: sortField === "income" ? 1 : 0.45 }}>
                {sortField === "income" ? (
                  sortDirection === "asc" ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  )
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 15l5 5 5-5M7 9l5-5 5 5" /></svg>
                )}
              </span>
              {openSortDropdown === "income" && (
                <div className="sort-dropdown-menu">
                  <button
                    type="button"
                    className={sortField === "income" && sortDirection === "desc" ? "dropdown-active" : ""}
                    onClick={(e) => { e.stopPropagation(); setSortField("income"); setSortDirection("desc"); setOpenSortDropdown(null); setReconPage(1); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                    Sort High to Low
                    {sortField === "income" && sortDirection === "desc" && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: '#e04f1a' }}><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className={sortField === "income" && sortDirection === "asc" ? "dropdown-active" : ""}
                    onClick={(e) => { e.stopPropagation(); setSortField("income"); setSortDirection("asc"); setOpenSortDropdown(null); setReconPage(1); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                    Sort Low to High
                    {sortField === "income" && sortDirection === "asc" && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: '#e04f1a' }}><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                  <div className="sort-dropdown-divider" />
                  <button type="button" onClick={(e) => { e.stopPropagation(); setSortField("date"); setSortDirection("desc"); setOpenSortDropdown(null); setReconPage(1); }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><polyline points="3 3 3 8 8 8" /></svg>
                    Clear sorting
                  </button>
                </div>
              )}
            </span>

            <span>Action</span>
          </div>

          {selectedHistoryIds.length === 0 ? (
            <div className="accountant-reconciliation-table-empty">
              <strong>Select a statement above to see its transactions.</strong>
              <span>You can select multiple statements to view their transactions together.</span>
            </div>
          ) : selectedRecons.length < selectedHistoryIds.length ? (
            <div className="accountant-reconciliation-table-empty">
              <strong>Loading statement…</strong>
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="accountant-reconciliation-table-empty">
              <strong>
                {activeTab === "reviewed"
                  ? "No reconciled transactions yet."
                  : activeTab === "excluded"
                    ? "No excluded transactions yet."
                    : combinedRows.length === 0
                      ? "No transactions in the selected statements."
                      : "No transactions match these filters."}
              </strong>
              {activeTab === "unreviewed" && combinedRows.length > 0 && (
                <span>Try changing the search or filter.</span>
              )}
            </div>
          ) : (
            pagedReconRows.map(({ reconId, statementLabel, bankTxIndex, row }) => {
              const key = mkey(reconId, bankTxIndex);
              const matchEntry = optimisticMatches.get(key);
              const isConfirmed = matchEntry?.status === "confirmed";
              const isExcluded = matchEntry?.status === "excluded";
              const candidates = candidateMatches.get(key) ?? [];
              const hasCandidates = candidates.length > 0;
              const isExpanded = expandedKey === key;
              const isCatExpanded = categorizeKey === key;

              const isSelectable = activeTab === "excluded"
                ? (isExcluded && !isSessionCompleted)
                : (!isConfirmed && !isExcluded && !hasCandidates && !isSessionCompleted);
              const rowType = row.credit != null ? "revenue" : "expense";
              const isRowDisabled = activeTab === "excluded"
                ? false
                : (isSelectable && selectedType !== null && rowType !== selectedType);

              const matchedTx = isConfirmed && matchEntry?.transactionId
                ? entityTxs.find((t) => t.id === matchEntry.transactionId) ?? null
                : null;

              const rowIsCategorized = isConfirmed && (
                matchedTx
                  ? (matchedTx.metadata?.source === "reconciliation_categorized" || matchedTx.metadata?.categorized === true)
                  : !hasCandidates
              );

              const propertyDisplay = entityTxsLoading ? (
                <span className="recon-shimmer" />
              ) : isConfirmed && matchedTx ? (
                matchedTx.propertyNames[0]
                  ? <Link href={`/dashboard/accountant/clients/${clientId}/entities/${entityId}/properties/${matchedTx.propertyIds[0]}`} className="is-link">{matchedTx.propertyNames[0]}</Link>
                  : <span className="is-muted">Not assigned</span>
              ) : (
                <select
                  className="recon-property-select"
                  value={assignedProperties.get(key) ?? ""}
                  onChange={(e) => {
                    setAssignedProperties((prev) => {
                      const next = new Map(prev);
                      if (e.target.value) next.set(key, e.target.value);
                      else next.delete(key);
                      return next;
                    });
                  }}
                >
                  <option value="">Not assigned</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              );

              const categoryDisplay = entityTxsLoading ? (
                <span className="recon-shimmer" />
              ) : isConfirmed ? (
                matchedTx ? (
                  <>
                    <strong>{matchedTx.categoryName}</strong>
                    {matchedTx.subcategoryName && <small>{matchedTx.subcategoryName}</small>}
                    <em>
                      {matchedTx.metadata?.source === "reconciliation_categorized" || matchedTx.metadata?.categorized === true
                        ? "Categorized"
                        : "Matched"}
                    </em>
                  </>
                ) : (
                  <>
                    <strong>Reconciled</strong>
                    <em>{!hasCandidates ? "Categorized" : "Matched"}</em>
                  </>
                )
              ) : isExcluded ? (
                <>
                  <strong>Excluded</strong>
                </>
              ) : hasCandidates ? (
                <>
                  <strong>{candidates[0].categoryName}</strong>
                  {candidates[0].subcategoryName && <small>{candidates[0].subcategoryName}</small>}
                </>
              ) : (
                <button
                  type="button"
                  className="recon-categorize-trigger-btn"
                  disabled={isRowDisabled}
                  onClick={() => {
                    setMatchError(null);
                    setCategorizeError(null);
                    setCategorizeKey(isCatExpanded ? null : key);
                    setExpandedKey(null);
                  }}
                >
                  {isCatExpanded ? "Hide Form" : "Categorize"}
                </button>
              );

              let actionCell: import("react").ReactNode;
              if (matchesLoading) {
                actionCell = <span className="recon-shimmer" style={{ width: 90 }} />;
              } else if (isConfirmed) {
                actionCell = (
                  <div className="recon-action-confirmed">
                    <span className="recon-reconciled-badge">Reconciled</span>
                    {!isSessionCompleted && (
                      <button type="button" className="recon-undo-btn" disabled={isPending} onClick={() => doUndoMatch(reconId, bankTxIndex)}>
                        Undo
                      </button>
                    )}
                  </div>
                );
              } else if (isExcluded) {
                actionCell = (
                  <div className="recon-action-confirmed">
                    <span className="recon-excluded-badge">Excluded</span>
                    {!isSessionCompleted && (
                      <button type="button" className="recon-undo-btn" disabled={isPending} onClick={() => doUndoMatch(reconId, bankTxIndex)}>
                        Undo
                      </button>
                    )}
                  </div>
                );
              } else if (!isSessionCompleted && hasCandidates) {
                const btnText = candidates.length > 1
                  ? (isExpanded ? "Hide Matches" : "View Matches")
                  : (isExpanded ? "Hide Match" : "Review Match");
                actionCell = (
                  <button
                    type="button"
                    className="recon-action-match-btn"
                    onClick={() => {
                      setMatchError(null);
                      setCategorizeKey(null);
                      setExpandedKey(isExpanded ? null : key);
                    }}
                  >
                    {btnText}
                  </button>
                );
              } else {
                actionCell = <span className="is-muted">—</span>;
              }

              return (
                <div
                  key={key}
                  className={[
                    "recon-row-wrapper",
                    isConfirmed ? "recon-row-wrapper--confirmed" : "",
                    rowIsCategorized ? "recon-row-wrapper--confirmed-categorized" : "",
                    isExcluded ? "recon-row-wrapper--excluded" : "",
                    isExpanded ? "recon-row-wrapper--expanded" : "",
                    isCatExpanded && !isConfirmed && !isExcluded ? "recon-row-wrapper--categorizing" : "",
                  ].filter(Boolean).join(" ")}
                  style={{
                    opacity: isRowDisabled ? 0.45 : undefined,
                    transition: isRowDisabled ? "opacity 0.2s ease" : undefined,
                  }}
                >
                  <div className="accountant-reconciliation-table-row">
                    <div className="accountant-reconciliation-status-cell" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isSelectable ? (
                        <input
                          type="checkbox"
                          className="custom-recon-checkbox"
                          checked={selectedRowKeys.has(key)}
                          disabled={isRowDisabled}
                          onChange={() => {
                            setSelectedRowKeys((prev) => {
                              const next = new Set(prev);
                              if (next.has(key)) next.delete(key);
                              else next.add(key);
                              return next;
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                      )}
                      <span className={isConfirmed || isExcluded ? "" : "is-alert"} style={{ flexShrink: 0 }}>
                        {isConfirmed ? "✓" : "!"}
                      </span>
                    </div>

                    <div>
                      <strong>{row.payee ?? row.description}</strong>
                      <small>{row.date}</small>
                      {!isConfirmed && !isExcluded && hasCandidates && !entityTxsLoading && (
                        <span className="recon-match-badge">✓ {candidates.length} Match{candidates.length > 1 ? "es" : ""} Found</span>
                      )}
                      {entityTxsLoading && !isConfirmed && !isExcluded && (
                        <span className="recon-shimmer" style={{ marginTop: 6, display: "block" }} />
                      )}
                    </div>

                    <div>
                      <small style={{ color: "#6b7280" }}>{statementLabel}</small>
                    </div>

                    <div>{propertyDisplay}</div>
                    <div>{categoryDisplay}</div>

                    <strong style={{ color: row.debit != null ? "#dc2626" : undefined }}>
                      {row.debit != null ? fmtAud(-row.debit) : "— "}
                    </strong>

                    <strong className={row.credit != null ? "is-good-text" : ""}>
                      {row.credit != null ? fmtAud(row.credit) : "— "}
                    </strong>

                    {actionCell}
                  </div>

                  {isExpanded && !isConfirmed && !isExcluded && candidates.length > 0 && (
                    <div className="recon-expand-panel">
                      {candidates.map((candidate) => (
                        <div key={candidate.id} className="recon-match-card">
                          <div className="recon-match-card-dot" />
                          <div className="recon-match-card-body">
                            <p className="recon-match-card-title">Manual Entry Details</p>
                            <dl className="recon-match-card-fields">
                              <div className="recon-match-card-field">
                                <dt>Transaction ID</dt>
                                <dd>{shortId(candidate.id)}</dd>
                              </div>
                              <div className="recon-match-card-field">
                                <dt>Date</dt>
                                <dd>{candidate.invoiceDate}</dd>
                              </div>
                              <div className="recon-match-card-field">
                                <dt>Type</dt>
                                <dd style={{ textTransform: "capitalize" }}>{candidate.type}</dd>
                              </div>
                              {candidate.propertyNames[0] && (
                                <div className="recon-match-card-field">
                                  <dt>Property</dt>
                                  <dd>
                                    <Link
                                      href={`/dashboard/accountant/clients/${clientId}/entities/${entityId}/properties/${candidate.propertyIds[0]}`}
                                      className="is-link"
                                    >
                                      {candidate.propertyNames[0]}
                                    </Link>
                                  </dd>
                                </div>
                              )}
                              <div className="recon-match-card-field">
                                <dt>Amount</dt>
                                <dd>{fmtAud(candidate.grossAmount)}</dd>
                              </div>
                              <div className="recon-match-card-field">
                                <dt>GST Amount</dt>
                                <dd>{fmtAud(candidate.gstAmount)}</dd>
                              </div>
                            </dl>
                            <div className="recon-match-card-row2">
                              <span className="recon-gst-toggle">
                                GST Included:
                                <span className={`recon-gst-toggle-pill${candidate.gstAmount > 0 ? "" : " is-off"}`} aria-hidden="true" />
                              </span>
                              <span className="recon-view-invoice" aria-disabled="true">
                                <UploadAltIcon />
                                View Invoice
                              </span>
                            </div>
                          </div>
                          <div className="recon-match-card-actions">
                            <button
                              type="button"
                              className="recon-confirm-btn"
                              disabled={confirmingKey !== null || isPending || isSessionCompleted}
                              onClick={() => { void doConfirmMatch(reconId, bankTxIndex, candidate); }}
                            >
                              {confirmingKey === key ? (
                                <>
                                  <span className="recon-btn-spinner" aria-hidden="true" />
                                  Saving…
                                </>
                              ) : "Confirm Match"}
                            </button>
                            <button
                              type="button"
                              className="recon-exclude-btn"
                              disabled={confirmingKey !== null || isPending || isSessionCompleted}
                              onClick={() => doExcludeMatch(reconId, bankTxIndex)}
                            >
                              Exclude
                            </button>
                            {matchError && (
                              <div className="recon-match-error" role="alert">
                                <svg className="recon-match-error-icon" viewBox="0 0 20 20" aria-hidden="true" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-.75-9.25a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-1.5 0v-3zm.75 6a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" clipRule="evenodd" />
                                </svg>
                                <span>{matchError}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isCatExpanded && !isConfirmed && !isExcluded && (
                    <div className="recon-categorize-panel">
                      <div className="recon-categorize-card">
                        <div className="recon-categorize-title">
                          <span className="recon-categorize-title-dot" />
                          <strong>Categorize Transaction</strong>
                        </div>

                        <div className="recon-categorize-grid">
                          <div className="recon-categorize-field">
                            <label className="recon-categorize-label">
                              Property Name <span className="is-required">*</span>
                            </label>
                            {categorizeIsSplit ? (
                              <div className="recon-categorize-input" style={{ background: '#f9fafb', color: '#6b7280', display: 'flex', alignItems: 'center', height: '50px' }}>
                                Split Transaction
                              </div>
                            ) : (
                              <StaticSelect
                                value={categorizePropertyId}
                                placeholder="Select property"
                                options={properties.map((p) => ({ label: p.name, value: p.id }))}
                                onChange={setCategorizePropertyId}
                              />
                            )}
                          </div>

                          <div className="recon-categorize-field">
                            <label className="recon-categorize-label">
                              Transaction Type <span className="is-required">*</span>
                            </label>
                            <StaticSelect
                              value={categorizeType}
                              options={TRANSACTION_TYPE_OPTIONS}
                              onChange={(val) => {
                                const nextType = parseTransactionType(val);
                                setCategorizeType(nextType);
                                // Cost base is capitalised, not depreciated, so
                                // it must NOT set is_asset_purchase — doing so
                                // sent asset_class: null and the backend
                                // rejected every cost-base save.
                                if (!allowsAssetPurchase(nextType)) {
                                  setCategorizeAssetDraft(null);
                                }
                                if (!allowsBusinessExtras(nextType)) {
                                  setCategorizeIsPersonal(false);
                                }
                                setCategorizeCategoryId(null);
                                setCategorizeSubcategoryId(null);
                              }}
                            />
                          </div>

                          {!hidesCategoryPicker(categorizeType) && (
                            <div className="recon-categorize-field">
                              <label className="recon-categorize-label">
                                Category <span className="is-required">*</span>
                              </label>
                              <StaticSelect
                                value={String(categorizeCategoryId ?? "")}
                                placeholder="Select category"
                                options={categorizeCategories.map((c) => ({ label: c.name, value: String(c.id) }))}
                                onChange={(val) => {
                                  setCategorizeCategoryId(val ? Number(val) : null);
                                  setCategorizeSubcategoryId(null);
                                }}
                              />
                            </div>
                          )}

                          {categorizeType === "cost_base" && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              background: '#f0f9ff',
                              border: '1px solid #e0f2fe',
                              color: '#0284c7',
                              borderRadius: '8px',
                              padding: '12px 16px',
                              fontSize: '13px',
                              height: '50px',
                              marginTop: '24px',
                              boxSizing: 'border-box'
                            }}>
                              No subcategory for Property Cost Base — one free-text/typeable category only.
                            </div>
                          )}

                          {!hidesSubcategoryPicker(categorizeType) && showCategorizeSubcategorySelect && (
                            <div className="recon-categorize-field">
                              <label className="recon-categorize-label">
                                Subcategory <span className="is-required">*</span>
                              </label>
                              <StaticSelect
                                value={String(categorizeSubcategoryId ?? "")}
                                placeholder="Select subcategory"
                                options={categorizeSubcategories.map((s) => ({ label: s.name, value: String(s.id) }))}
                                onChange={(val) => setCategorizeSubcategoryId(val ? Number(val) : null)}
                                disabled={!categorizeCategoryId || categorizeSubcategories.length === 0}
                              />
                            </div>
                          )}
                        </div>

                        {/* Add Asset.
                            Was a ~240-line three-step wizard here, a second
                            copy of the one in TransactionsFeature. Both are
                            AssetBuilder now, so the categorize drawer and the
                            add-transaction form cannot drift apart again. */}
                        {allowsBusinessExtras(categorizeType) && (
                          <div style={{ marginTop: 16 }}>
                            {categorizeAssetDraft && (
                              <AssetSummaryChip
                                draft={categorizeAssetDraft}
                                onRemove={() => setCategorizeAssetDraft(null)}
                              />
                            )}

                            {!categorizeAssetDraft && !assetBuilderOpen && (
                              <button
                                type="button"
                                className="figma-add-asset-trigger"
                                onClick={() => setAssetBuilderOpen(true)}
                              >
                                + Add Asset
                              </button>
                            )}

                            {assetBuilderOpen && (
                              <AssetBuilder
                                initial={categorizeAssetDraft}
                                onCancel={() => setAssetBuilderOpen(false)}
                                onSubmit={(draft) => {
                                  setCategorizeAssetDraft(draft);
                                  setAssetBuilderOpen(false);
                                }}
                              />
                            )}
                          </div>
                        )}

                        {/* Private-use split. Expense only — the backend
                            rejects it on any other type, and a wholly private
                            line is the Personal Transaction type instead. */}
                        {allowsPersonalPortion(categorizeType) && (
                          <div style={{ marginTop: 16 }}>
                            <div className="figma-toggle-container" style={{ marginBottom: categorizeIsPersonal ? 16 : 0 }}>
                              <div className="figma-toggle-info">
                                <span className="figma-toggle-title">Was part of this personal?</span>
                                <span className="figma-toggle-desc">Split this transaction between business and personal use. Only the business share is deductible.</span>
                              </div>
                              <label className="figma-switch">
                                <input
                                  type="checkbox"
                                  checked={categorizeIsPersonal}
                                  onChange={(e) => {
                                    setCategorizeIsPersonal(e.target.checked);
                                  }}
                                />
                                <span className="figma-switch-slider" />
                              </label>
                            </div>

                            {categorizeIsPersonal && (
                              <div className="figma-personal-alloc-section">
                                <div className="recon-categorize-grid" style={{ marginBottom: 16 }}>
                                  <div className="recon-categorize-field">
                                    <label className="recon-categorize-label">Personal Allocation</label>
                                    <StaticSelect
                                      value={categorizePersonalAllocationType}
                                      options={[
                                        { label: "Percentage", value: "percentage" },
                                        { label: "Amount", value: "amount" },
                                      ]}
                                      onChange={(value) => setCategorizePersonalAllocationType(value as "percentage" | "amount")}
                                    />
                                  </div>
                                  <div className="recon-categorize-field">
                                    <label className="recon-categorize-label">
                                      {categorizePersonalAllocationType === "percentage" ? "Personal %" : "Personal Amount"}
                                    </label>
                                    <input
                                      type="number"
                                      className="recon-categorize-input"
                                      style={{ height: '48px' }}
                                      value={categorizePersonalValue}
                                      onChange={(e) => setCategorizePersonalValue(e.target.value)}
                                    />
                                  </div>
                                </div>

                                <div className="figma-portion-wrapper">
                                  <div className="figma-portion-box">
                                    <span className="figma-portion-label">Business portion (deductible)</span>
                                    <span className="figma-portion-value">A$ {categorizeBusinessPortion.toFixed(2)}</span>
                                  </div>
                                  <div className="figma-portion-box">
                                    <span className="figma-portion-label">Personal portion</span>
                                    <span className="figma-portion-value">A$ {categorizePersonalPortion.toFixed(2)}</span>
                                  </div>
                                </div>

                                {categorizePersonalError && (
                                  <p className="recon-split-row-error" role="alert">
                                    {categorizePersonalError}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Is it a regular payment? */}
                        {allowsBusinessExtras(categorizeType) && (
                          <div style={{ marginTop: 16 }}>
                            <div className="figma-toggle-container" style={{ marginBottom: categorizeIsRegularPayment ? 16 : 0 }}>
                              <div className="figma-toggle-info">
                                <span className="figma-toggle-title">Is it a regular payment?</span>
                                <span className="figma-toggle-desc">Set a due date and reminder alert</span>
                              </div>
                              <label className="figma-switch">
                                <input
                                  type="checkbox"
                                  checked={categorizeIsRegularPayment}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setCategorizeIsRegularPayment(checked);
                                    if (!checked) {
                                      setCategorizeDueDate("");
                                      setCategorizeDueDateTouched(false);
                                      setCategorizeAlertName("");
                                      setCategorizeUserEditedAlertName(false);
                                    }
                                  }}
                                />
                                <span className="figma-switch-slider" />
                              </label>
                            </div>

                            {categorizeIsRegularPayment && (
                              <div className="recon-categorize-grid" style={{ marginBottom: 16 }}>
                                <div className="recon-categorize-field">
                                  <label className="recon-categorize-label">Due Date <span className="is-required">*</span></label>
                                  <input
                                    type="date"
                                    className="recon-categorize-input"
                                    style={{ height: '48px' }}
                                    value={categorizeDueDate}
                                    onChange={(e) => setCategorizeDueDate(e.target.value)}
                                    onBlur={() => setCategorizeDueDateTouched(true)}
                                  />
                                  {categorizeDueDateTouched && categorizeDueDateError && (
                                    <p className="recon-split-row-error">{categorizeDueDateError}</p>
                                  )}
                                </div>
                                <div className="recon-categorize-field">
                                  <label className="recon-categorize-label">Alert Name <span className="is-required">*</span></label>
                                  <input
                                    type="text"
                                    className="recon-categorize-input"
                                    style={{ height: '48px' }}
                                    placeholder="e.g. Quarterly insurance reminder"
                                    value={categorizeAlertName}
                                    onChange={(e) => {
                                      setCategorizeAlertName(e.target.value);
                                      setCategorizeUserEditedAlertName(true);
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Split option and section placed before GST */}
                        {allowsBusinessExtras(categorizeType) && (
                          <div className="recon-categorize-split-container" style={{ marginTop: 16 }}>
                            <label className="recon-categorize-checkbox-row">
                              <input
                                type="checkbox"
                                className="custom-recon-checkbox"
                                checked={categorizeIsSplit}
                                onChange={(e) => handleCategorizeSplitToggle(e.target.checked)}
                              />
                              <span>Is this a split transaction?</span>
                            </label>

                            {categorizeIsSplit && (
                              <div className="recon-categorize-split-section">
                                <div className="recon-split-header">
                                  <span>Property Name <span className="is-required">*</span></span>
                                  <span>Amount <span className="is-required">*</span></span>
                                  <span></span>
                                </div>

                                {categorizeSplitRows.map((row) => {
                                  const rowError = categorizeSplitErrors[row.id];
                                  const propertyError = (rowError === "Choose a property." || rowError === "Property already used in another split.") ? rowError : undefined;
                                  const amountError = rowError === "Enter a positive amount." ? rowError : undefined;

                                  return (
                                    <div key={row.id} className="recon-split-row">
                                      <StaticSelect
                                        value={row.propertyId}
                                        placeholder="Select Property"
                                        options={properties.map((p) => ({ label: p.name, value: p.id }))}
                                        onChange={(value) => updateCategorizeSplitRow(row.id, { propertyId: value })}
                                        error={propertyError}
                                      />
                                      <div className="recon-categorize-field">
                                        <div className="recon-categorize-amount-input-wrapper">
                                          <input
                                            type="number"
                                            inputMode="decimal"
                                            step="0.01"
                                            placeholder="0.00"
                                            className={`recon-categorize-input${amountError ? " has-error" : ""}`}
                                            value={row.amount}
                                            onKeyDown={(e) => {
                                              if (e.key === "-" || e.key === "Minus") {
                                                e.preventDefault();
                                              }
                                            }}
                                            onChange={(e) => {
                                              const val = e.target.value.replace(/-/g, "");
                                              updateCategorizeSplitRow(row.id, { amount: val });
                                            }}
                                          />
                                          <span className="recon-categorize-amount-currency">A$</span>
                                        </div>
                                        {amountError && (
                                          <p className="recon-split-row-error">{amountError}</p>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        className="recon-split-remove-btn"
                                        disabled={categorizeSplitRows.length <= 1}
                                        onClick={() => removeCategorizeSplitRow(row.id)}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  );
                                })}

                                {categorizeSplitErrors.__form && (
                                  <p className="recon-split-form-error">{categorizeSplitErrors.__form}</p>
                                )}

                                <div className="recon-split-footer">
                                  <span
                                    className={`recon-split-total-info${!categorizeSplitMatches ? " is-mismatch" : ""}`}
                                  >
                                    {activeGrossAmount > 0
                                      ? `Split total: ${categorizeSplitTotal.toFixed(2)} of ${activeGrossAmount.toFixed(2)}`
                                      : "Splits must equal the transaction total."}
                                  </span>
                                  <button
                                    type="button"
                                    className="recon-split-add-btn"
                                    onClick={addCategorizeSplitRow}
                                    disabled={properties.length < 2}
                                  >
                                    + Add Property
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="recon-categorize-gst">
                          <span className="recon-categorize-gst-label">GST Applicable</span>
                          <div className="recon-categorize-gst-options">
                            <label className="recon-categorize-gst-option">
                              <input
                                type="radio"
                                name={`gst-${key}`}
                                checked={categorizeGst === true}
                                onChange={() => {
                                  setCategorizeGst(true);
                                  const rec = reconCache.get(reconId);
                                  const bankTx = rec?.transactions[bankTxIndex];
                                  const gross = bankTx ? (bankTx.debit ?? bankTx.credit ?? 0) : 0;
                                  setCategorizeGstAmount(String(Math.round((gross / 11) * 100) / 100));
                                }}
                              />
                              Yes
                            </label>
                            <label className="recon-categorize-gst-option">
                              <input
                                type="radio"
                                name={`gst-${key}`}
                                checked={categorizeGst === false}
                                onChange={() => { setCategorizeGst(false); setCategorizeGstAmount(""); }}
                              />
                              No
                            </label>
                          </div>
                          {categorizeGst && (
                            <div className="recon-categorize-field" style={{ marginTop: 8 }}>
                              <label className="recon-categorize-label">GST Amount</label>
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="recon-categorize-input"
                                value={categorizeGstAmount}
                                onChange={(e) => setCategorizeGstAmount(e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                        <hr className="recon-categorize-divider" />
                        {categorizeError && (
                          <div className="recon-match-error" role="alert" style={{ marginBottom: 12 }}>
                            <svg className="recon-match-error-icon" viewBox="0 0 20 20" aria-hidden="true" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-.75-9.25a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-1.5 0v-3zm.75 6a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" clipRule="evenodd" />
                            </svg>
                            <span>{categorizeError}</span>
                          </div>
                        )}
                        <div className="recon-categorize-footer">
                          <button
                            type="button"
                            className="recon-categorize-exclude-btn"
                            disabled={categorizeSaving}
                            onClick={() => { doExcludeMatch(reconId, bankTxIndex); setCategorizeKey(null); }}
                          >
                            Exclude
                          </button>
                          <button
                            type="button"
                            className="recon-categorize-save-btn"
                            disabled={
                              categorizeSaving ||
                              !categorizeCategoryId ||
                              (!categorizeIsSplit && !categorizePropertyId) ||
                              (categorizeIsSplit && (Object.keys(categorizeSplitErrors).length > 0 || !categorizeSplitMatches)) ||
                              (categorizeIsRegularPayment && (!categorizeDueDate || !!categorizeDueDateError || !categorizeAlertName.trim()))
                            }
                            onClick={() => { void doSaveCategorize(reconId, bankTxIndex); }}
                          >
                            {categorizeSaving ? (
                              <><span className="recon-btn-spinner" aria-hidden="true" />Saving…</>
                            ) : "Save & Categorize"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer className="accountant-reconciliation-footer">
          <div className="premium-pagination-container" style={{ borderTop: 'none', padding: 0, background: 'transparent', flex: 1 }}>
            {/* Left Section: Items per page and page range details */}
            <div className="premium-pagination-left">
              <span className="premium-pagination-label">Items per page</span>
              <div className="premium-pagination-select-wrapper">
                <select
                  className="premium-pagination-select"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(e.target.value);
                    setReconPage(1);
                  }}
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="all">All</option>
                </select>
              </div>
              <span className="premium-pagination-info">
                {totalItems === 0
                  ? "0–0 of 0 items"
                  : `${(activePage - 1) * numericPageSize + 1}–${Math.min(activePage * numericPageSize, totalItems)} of ${totalItems} items`}
                {reconciledCount > 0 && (
                  <> · {reconciledCount} reconciled</>
                )}
              </span>
            </div>

            {/* Right Section: First, Previous, Page Input, Next, Last */}
            <div className="premium-pagination-right">
              {/* First Page */}
              <button
                type="button"
                className="premium-pagination-btn premium-pagination-icon-btn"
                title="First Page"
                onClick={() => setReconPage(1)}
                disabled={activePage === 1}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
                  <line x1="5" y1="5" x2="5" y2="19" />
                  <polyline points="19 5 12 12 19 19" />
                </svg>
              </button>

              {/* Previous Page */}
              <button
                type="button"
                className="premium-pagination-btn"
                onClick={() => setReconPage((prev) => Math.max(prev - 1, 1))}
                disabled={activePage === 1}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span className="premium-pagination-btn-text">Previous</span>
              </button>

              {/* Page Selector Input Box */}
              <div className="premium-pagination-page-input-wrapper">
                <input
                  type="number"
                  className="premium-pagination-page-input"
                  value={pageInputValue}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "") {
                      setPageInputValue("");
                      return;
                    }
                    if (/^[1-9]\d*$/.test(value)) {
                      const pageNum = Number(value);
                      if (pageNum <= reconTotalPages) {
                        setPageInputValue(value);
                      }
                    }
                  }}
                  onBlur={() => {
                    const pageNum = Number(pageInputValue);
                    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= reconTotalPages) {
                      setReconPage(pageNum);
                    } else {
                      setPageInputValue(String(activePage));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (["e", "E", "-", "+", "."].includes(e.key)) {
                      e.preventDefault();
                      return;
                    }
                    if (e.key === "Enter") {
                      const pageNum = Number(pageInputValue);
                      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= reconTotalPages) {
                        setReconPage(pageNum);
                        e.currentTarget.blur();
                      } else {
                        setPageInputValue(String(activePage));
                        e.currentTarget.blur();
                      }
                    }
                  }}
                  onPaste={(e) => {
                    const pastedData = e.clipboardData.getData("text");
                    if (!/^[1-9]\d*$/.test(pastedData) || Number(pastedData) > reconTotalPages) {
                      e.preventDefault();
                    }
                  }}
                  min={1}
                  max={reconTotalPages}
                />
                <span className="premium-pagination-label">of {reconTotalPages}</span>
              </div>

              {/* Next Page */}
              <button
                type="button"
                className="premium-pagination-btn"
                onClick={() => setReconPage((prev) => Math.min(prev + 1, reconTotalPages))}
                disabled={activePage === reconTotalPages}
              >
                <span className="premium-pagination-btn-text">Next</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>

              {/* Last Page */}
              <button
                type="button"
                className="premium-pagination-btn premium-pagination-icon-btn"
                title="Last Page"
                onClick={() => setReconPage(reconTotalPages)}
                disabled={activePage === reconTotalPages}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
                  <line x1="19" y1="5" x2="19" y2="19" />
                  <polyline points="5 5 12 12 5 19" />
                </svg>
              </button>
            </div>
          </div>
          <div className="accountant-reconciliation-footer-actions">
            {completeError && (
              <div className="accountant-reconciliation-error-alert" role="alert">
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <span>{completeError}</span>
              </div>
            )}
            <div>
              <button
                type="button"
                disabled={combinedRows.length === 0}
                title="Export all transactions across every tab"
                onClick={() => exportReconCsv(combinedRows, `reconciliation-${session.id}.csv`)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3v12" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
                Export CSV
              </button>
              {!isSessionCompleted && (
                <button
                  type="button"
                  disabled={completingSession}
                  onClick={() => {
                    setCompleteError(null);
                    setShowCompleteConfirm(true);
                  }}
                >
                  {completingSession ? (
                    <><span className="recon-btn-spinner" aria-hidden="true" />Completing…</>
                  ) : "Complete Reconciliation"}
                </button>
              )}
            </div>
          </div>
        </footer>
      </div>

      {toastReconId && (
        <ReconCompleteToast
          href={`/dashboard/accountant/clients/${clientId}/entities/${entityId}/reconciliation/${sessionId}?id=${encodeURIComponent(toastReconId)}`}
          onClose={() => setToastReconId(null)}
        />
      )}

      {bulkOpen && (
        <div className="fixed inset-0 bg-[#101828]/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 1000 }}>
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900 m-0">
                Categorize Transactions
                <span className="recon-bulk-badge">{selectedEligibleRows.length} selected</span>
              </h3>
              <button
                type="button"
                aria-label="Close"
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
                disabled={bulkSaving || bulkExcluding}
                onClick={() => setBulkOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="recon-bulk-note">
                You&apos;re categorizing multiple transactions at once. These values will be
                applied to all selected transactions. Split transaction is not available in
                bulk mode.
              </div>

              <div className="recon-categorize-grid">
                <div className="recon-categorize-field">
                  <label className="recon-categorize-label">
                    Property Name <span className="is-required">*</span>
                  </label>
                  <StaticSelect
                    value={bulkPropertyId}
                    placeholder="Select property"
                    options={properties.map((p) => ({ label: p.name, value: p.id }))}
                    onChange={setBulkPropertyId}
                  />
                </div>

                <div className="recon-categorize-field">
                  <label className="recon-categorize-label">
                    Transaction Type <span className="is-required">*</span>
                  </label>
                  <StaticSelect
                    value={bulkType}
                    options={TRANSACTION_TYPE_OPTIONS}
                    onChange={(val) => {
                      setBulkType(parseTransactionType(val));
                      setBulkCategoryId(null);
                      setBulkSubcategoryId(null);
                    }}
                  />
                </div>

                <div className="recon-categorize-field">
                  <label className="recon-categorize-label">
                    Category <span className="is-required">*</span>
                  </label>
                  <StaticSelect
                    value={String(bulkCategoryId ?? "")}
                    placeholder="Select category"
                    options={bulkCategories.map((c) => ({ label: c.name, value: String(c.id) }))}
                    onChange={(val) => {
                      setBulkCategoryId(val ? Number(val) : null);
                      setBulkSubcategoryId(null);
                    }}
                  />
                </div>

                {showBulkSubcategorySelect && (
                  <div className="recon-categorize-field">
                    <label className="recon-categorize-label">
                      Subcategory <span className="is-required">*</span>
                    </label>
                    <StaticSelect
                      value={String(bulkSubcategoryId ?? "")}
                      placeholder="Select subcategory"
                      options={bulkSubcategories.map((s) => ({ label: s.name, value: String(s.id) }))}
                      onChange={(val) => setBulkSubcategoryId(val ? Number(val) : null)}
                      disabled={!bulkCategoryId || bulkSubcategories.length === 0}
                    />
                  </div>
                )}
              </div>

              <div className="recon-categorize-gst">
                <span className="recon-categorize-gst-label">GST Applicable</span>
                <div className="recon-categorize-gst-options">
                  <label className="recon-categorize-gst-option">
                    <input
                      type="radio"
                      name="bulk-gst"
                      checked={bulkGst === true}
                      onChange={() => setBulkGst(true)}
                    />
                    Yes
                  </label>
                  <label className="recon-categorize-gst-option">
                    <input
                      type="radio"
                      name="bulk-gst"
                      checked={bulkGst === false}
                      onChange={() => setBulkGst(false)}
                    />
                    No
                  </label>
                </div>
                {bulkGst && (
                  <p className="recon-bulk-gst-hint">
                    GST will be recorded as 1/11th of each transaction&apos;s amount.
                  </p>
                )}
              </div>

              {/* Private-use split applied to every selected line. Percentage
                  only: each line's own amounts are then derived from its own
                  total, so lines of different sizes all split correctly. */}
              {allowsPersonalPortion(bulkType) && (
                <div style={{ marginTop: 16 }}>
                  <div className="figma-toggle-container" style={{ marginBottom: bulkIsPersonal ? 16 : 0 }}>
                    <div className="figma-toggle-info">
                      <span className="figma-toggle-title">Was part of these personal?</span>
                      <span className="figma-toggle-desc">
                        Applies the same private-use share to all {selectedEligibleRows.length} selected
                        {selectedEligibleRows.length === 1 ? " transaction" : " transactions"}. Only the business share is deductible.
                      </span>
                    </div>
                    <label className="figma-switch">
                      <input
                        type="checkbox"
                        checked={bulkIsPersonal}
                        onChange={(e) => setBulkIsPersonal(e.target.checked)}
                      />
                      <span className="figma-switch-slider" />
                    </label>
                  </div>

                  {bulkIsPersonal && (
                    <div className="figma-personal-alloc-section">
                      <div className="recon-categorize-field">
                        <label className="recon-categorize-label">
                          Personal % <span className="is-required">*</span>
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max="100"
                          step="any"
                          className="recon-categorize-input"
                          style={{ height: "48px" }}
                          placeholder="e.g. 30"
                          value={bulkPersonalPercentage}
                          onChange={(e) => {
                            // Digits and one dot only — the same guard the
                            // single-line drawer uses.
                            const clean = e.target.value.replace(/[^0-9.]/g, "");
                            const parts = clean.split(".");
                            setBulkPersonalPercentage(
                              parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("")}` : parts[0],
                            );
                          }}
                        />
                        {bulkPersonalError && (
                          <p className="recon-split-row-error" role="alert">{bulkPersonalError}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {bulkError && (
                <div className="recon-match-error" role="alert" style={{ marginTop: 12 }}>
                  <svg className="recon-match-error-icon" viewBox="0 0 20 20" aria-hidden="true" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-.75-9.25a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-1.5 0v-3zm.75 6a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" clipRule="evenodd" />
                  </svg>
                  <span>{bulkError}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                type="button"
                className="recon-categorize-exclude-btn"
                disabled={bulkSaving || bulkExcluding}
                onClick={() => { void doBulkExclude(); }}
              >
                {bulkExcluding ? (
                  <><span className="recon-btn-spinner" aria-hidden="true" />Excluding…</>
                ) : "Exclude"}
              </button>
              <button
                type="button"
                className="recon-categorize-save-btn"
                disabled={
                  bulkSaving ||
                  bulkExcluding ||
                  !bulkPropertyId ||
                  !bulkCategoryId ||
                  !bulkSubcategoryId
                }
                onClick={() => { void doBulkCategorize(); }}
              >
                {bulkSaving ? (
                  <>
                    <span className="recon-btn-spinner" aria-hidden="true" />
                    {bulkProgress ? `Saving ${bulkProgress.done}/${bulkProgress.total}…` : "Saving…"}
                  </>
                ) : "Save & Categorize All"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompleteConfirm && (
        <div className="fixed inset-0 bg-[#101828]/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 1000 }}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 flex flex-col gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#fef3c7] text-[#d97706] shrink-0 self-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="flex flex-col gap-1 text-center">
              <h3 className="text-lg font-extrabold text-[#233152]">Complete Reconciliation</h3>
              <p className="text-xs text-slate-500 leading-normal mt-1">
                Mark this reconciliation as completed? You can still create new reconciliations for this entity later, but no more statements can be uploaded into this one.
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                className="flex-1 min-h-[44px] rounded-xl border border-slate-200 bg-transparent text-slate-600 font-bold hover:bg-slate-50 active:scale-[0.98] transition-all duration-150 text-sm cursor-pointer"
                onClick={() => setShowCompleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 min-h-[44px] rounded-xl font-bold text-white bg-[#28336e] hover:bg-[#1f2858] active:scale-[0.98] transition-all duration-150 text-sm shadow-sm cursor-pointer"
                onClick={handleConfirmComplete}
              >
                Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
