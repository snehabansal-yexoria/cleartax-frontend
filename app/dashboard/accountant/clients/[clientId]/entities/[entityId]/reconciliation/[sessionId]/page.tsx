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
} from "@/src/lib/coreApi";
import { getSession } from "@/src/lib/session";
import { AccountantReconciliationSkeleton } from "@/app/components/PortalSkeletons";

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

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function UploadAltIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width={13} height={13}>
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 21h14" />
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
  const RECON_PAGE_SIZE = 20;
  const [toastReconId, setToastReconId] = useState<string | null>(null);

  // Session completion
  const [completingSession, setCompletingSession] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  // Table filter/sort
  const [activeTab, setActiveTab] = useState<"unreviewed" | "reviewed" | "excluded">("unreviewed");
  const [filter, setFilter] = useState<ReconciliationFilter>("all");
  const [query, setQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<ReconciliationSort>("desc");
  const [past30DaysOnly, setPast30DaysOnly] = useState(false);

  const [optimisticMatches, addOptimisticMatch] = useOptimistic<
    Map<MatchKey, ReconciliationMatch>,
    MatchUpdate
  >(confirmedMatches, matchReducer);
  const [isPending, startTransition] = useTransition();
  const deferredEntityTxs = useDeferredValue(entityTxs);

  // Categorize panel
  const [categorizeKey, setCategorizeKey] = useState<MatchKey | null>(null);
  const [categorizeType, setCategorizeType] = useState<"expense" | "revenue">("expense");
  const [categorizeCategoryId, setCategorizeCategoryId] = useState<number | null>(null);
  const [categorizeSubcategoryId, setCategorizeSubcategoryId] = useState<number | null>(null);
  const [categorizePropertyId, setCategorizePropertyId] = useState<string>("");
  const [categorizeGst, setCategorizeGst] = useState<boolean>(false);
  const [categorizeGstAmount, setCategorizeGstAmount] = useState<string>("");
  const [categorizeCategories, setCategorizeCategories] = useState<CoreTransactionCategory[]>([]);
  const [categorizeSubcategories, setCategorizeSubcategories] = useState<CoreTransactionSubcategory[]>([]);
  const [categorizeSaving, setCategorizeSaving] = useState(false);
  const [categorizeError, setCategorizeError] = useState<string | null>(null);

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
    const txType: "expense" | "revenue" = bankTx.debit != null ? "expense" : "revenue";
    setCategorizeType(txType);
    setCategorizeCategoryId(null);
    setCategorizeSubcategoryId(null);
    setCategorizeSubcategories([]);
    setCategorizeGst(false);
    setCategorizeGstAmount("");
    let cancelled = false;
    void getFreshToken().then((token) => {
      fetch(`/api/transactions/categories?type=${txType}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d: { items?: CoreTransactionCategory[] }) => {
          if (!cancelled) setCategorizeCategories(d.items ?? []);
        })
        .catch(() => { });
    });
    return () => { cancelled = true; };
  }, [categorizeKey, reconCache]);

  useEffect(() => {
    if (!categorizeCategoryId) { setCategorizeSubcategories([]); return; }
    let cancelled = false;
    void getFreshToken().then((token) => {
      fetch(`/api/transactions/categories/${categorizeCategoryId}/sub-categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d: { items?: CoreTransactionSubcategory[] }) => {
          if (!cancelled) setCategorizeSubcategories(d.items ?? []);
        })
        .catch(() => { });
    });
    return () => { cancelled = true; };
  }, [categorizeCategoryId]);

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
    if (!categorizeCategoryId || !categorizePropertyId) {
      setCategorizeError("Category and Property are required.");
      return;
    }
    if (!categorizeSubcategoryId) {
      setCategorizeError("Please select sub category to continue.");
      return;
    }
    const rec = reconCache.get(reconId);
    const bankTx = rec?.transactions[bankTxIndex];
    if (!bankTx) return;
    setCategorizeError(null);
    setCategorizeSaving(true);
    const grossAmount = bankTx.debit ?? bankTx.credit ?? 0;
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
      const txRes = await fetch(`/api/entities/${entityId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: categorizeType,
          category_id: categorizeCategoryId,
          subcategory_id: categorizeSubcategoryId,
          invoice_date: bankTx.date,
          gross_amount: grossAmount,
          gst_amount: gstAmount,
          description: bankTx.payee ?? bankTx.description ?? null,
          internal_remarks: null,
          review_status: "reviewed",
          is_asset_purchase: false,
          metadata: { source: "reconciliation_categorized" },
          splits: [{ property_id: categorizePropertyId, split_percentage: 100, split_gross_amount: grossAmount }],
        }),
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
      const at = new Date(a.row.date).getTime();
      const bt = new Date(b.row.date).getTime();
      return sortDirection === "desc" ? bt - at : at - bt;
    });

  const reconTotalPages = Math.max(1, Math.ceil(visibleRows.length / RECON_PAGE_SIZE));
  const pagedReconRows = visibleRows.slice((reconPage - 1) * RECON_PAGE_SIZE, reconPage * RECON_PAGE_SIZE);

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
        {!isSessionCompleted && (
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
          <div className="accountant-document-empty-state">
            <DocumentIcon />
            <strong>No bank statements yet</strong>
            <p>Upload a PDF or CSV statement to begin extracting transactions.</p>
            {!isSessionCompleted && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={isProcessing}
                style={{ marginTop: 12 }}
              >
                <UploadIcon />
                Add Bank Statement
              </button>
            )}
            {!isSessionCompleted && (
              <button
                type="button"
                onClick={downloadSampleCsv}
                style={{ marginTop: 8, background: "none", border: "none", padding: 0, color: "#2563eb", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}
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
            Reviewed ({reconciledCount})
          </button>
          <button
            type="button"
            className={activeTab === "excluded" ? "is-active" : ""}
            onClick={() => { setActiveTab("excluded"); setFilter("all"); setReconPage(1); }}
          >
            Excluded ({excludedCount})
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
                {activeTab === "reviewed" ? "Matched Only" : "Matched"}
              </button>
              <button
                type="button"
                className={filter === "categorized" ? "is-active" : ""}
                onClick={() => { setFilter("categorized"); setReconPage(1); }}
              >
                {activeTab === "reviewed" ? "Categorized Only" : "Categorized"}
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
            className="accountant-reconciliation-sort"
            onClick={() => { setSortDirection((cur) => (cur === "desc" ? "asc" : "desc")); setReconPage(1); }}
          >
            Sort: Date
            <svg viewBox="0 0 24 24" aria-hidden="true" className="sort-chevron">
              <path d={sortDirection === "desc" ? "m6 9 6 6 6-6" : "m6 15 6-6 6 6"} />
            </svg>
          </button>
        </div>
      </section>

      {/* ── Combined transaction table ─────────────────────────────────── */}
      <section className="accountant-reconciliation-table">
        <div className="accountant-reconciliation-table-head">
          <span>Date &amp; Payee</span>
          <span>Statement</span>
          <span>Property</span>
          <span>Category</span>
          <span>Expense</span>
          <span>Income</span>
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

            const matchedTx = isConfirmed && matchEntry?.transactionId
              ? entityTxs.find((t) => t.id === matchEntry.transactionId) ?? null
              : null;

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
                  isExcluded ? "recon-row-wrapper--excluded" : "",
                  isExpanded ? "recon-row-wrapper--expanded" : "",
                  isCatExpanded && !isConfirmed && !isExcluded ? "recon-row-wrapper--categorizing" : "",
                ].filter(Boolean).join(" ")}
              >
                <div className="accountant-reconciliation-table-row">
                  <div className="accountant-reconciliation-status-cell">
                    <span className={isConfirmed || isExcluded ? "" : "is-alert"}>
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
                          <select
                            className="recon-categorize-select"
                            value={categorizePropertyId}
                            onChange={(e) => setCategorizePropertyId(e.target.value)}
                          >
                            <option value="">Select property</option>
                            {properties.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="recon-categorize-field">
                          <label className="recon-categorize-label">
                            Transaction Type <span className="is-required">*</span>
                          </label>
                          <select
                            className="recon-categorize-select"
                            value={categorizeType}
                            onChange={(e) => {
                              setCategorizeType(e.target.value as "expense" | "revenue");
                              setCategorizeCategoryId(null);
                              setCategorizeSubcategoryId(null);
                            }}
                          >
                            <option value="expense">Expense</option>
                            <option value="revenue">Revenue</option>
                          </select>
                        </div>
                        <div className="recon-categorize-field">
                          <label className="recon-categorize-label">
                            Category <span className="is-required">*</span>
                          </label>
                          <select
                            className="recon-categorize-select"
                            value={categorizeCategoryId ?? ""}
                            onChange={(e) => {
                              setCategorizeCategoryId(e.target.value ? Number(e.target.value) : null);
                              setCategorizeSubcategoryId(null);
                            }}
                          >
                            <option value="">Select category</option>
                            {categorizeCategories.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="recon-categorize-field">
                          <label className="recon-categorize-label">
                            Subcategory <span className="is-required">*</span>
                          </label>
                          <select
                            className="recon-categorize-select"
                            value={categorizeSubcategoryId ?? ""}
                            onChange={(e) => setCategorizeSubcategoryId(e.target.value ? Number(e.target.value) : null)}
                            disabled={!categorizeCategoryId || categorizeSubcategories.length === 0}
                          >
                            <option value="">Select subcategory</option>
                            {categorizeSubcategories.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
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
                              className="recon-categorize-select"
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
                          disabled={categorizeSaving || !categorizeCategoryId || !categorizePropertyId}
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
        <div className="recon-pagination-wrap">
          <span className="recon-pagination-copy">
            Showing{" "}
            <strong>
              {visibleRows.length === 0 ? 0 : (reconPage - 1) * RECON_PAGE_SIZE + 1}–{Math.min(reconPage * RECON_PAGE_SIZE, visibleRows.length)}
            </strong>{" "}
            of <strong>{visibleRows.length}</strong> transactions
            {reconciledCount > 0 && (
              <> · <strong>{reconciledCount}</strong> reconciled</>
            )}
          </span>
          {reconTotalPages > 1 && (
            <div className="recon-pagination">
              <button
                type="button"
                disabled={reconPage === 1}
                onClick={() => setReconPage((p) => p - 1)}
              >
                ← Prev
              </button>
              {Array.from({ length: reconTotalPages }, (_, idx) => idx + 1)
                .filter((p) => p === 1 || p === reconTotalPages || Math.abs(p - reconPage) <= 1)
                .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((v, idx) =>
                  v === "…" ? (
                    <span key={`e-${idx}`} className="recon-pagination-ellipsis">…</span>
                  ) : (
                    <button
                      key={v}
                      type="button"
                      className={v === reconPage ? "is-active" : undefined}
                      onClick={() => setReconPage(v as number)}
                    >
                      {v}
                    </button>
                  )
                )}
              <button
                type="button"
                disabled={reconPage === reconTotalPages}
                onClick={() => setReconPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
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
              onClick={() => {
                if (combinedRows.length === 0) return;
                const headers = ["statement", "date", "payee", "description", "debit", "credit", "balance", "reconciled"];
                const csv = [
                  headers.join(","),
                  ...visibleRows.map(({ reconId, statementLabel, bankTxIndex, row }) => {
                    const m = optimisticMatches.get(mkey(reconId, bankTxIndex));
                    return [
                      `"${statementLabel.replace(/"/g, '""')}"`,
                      row.date,
                      `"${(row.payee ?? "").replace(/"/g, '""')}"`,
                      `"${row.description.replace(/"/g, '""')}"`,
                      row.debit ?? "",
                      row.credit ?? "",
                      row.balance ?? "",
                      m?.status ?? "unreconciled",
                    ].join(",");
                  }),
                ].join("\n");
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                a.download = `reconciliation-${session.id}.csv`;
                a.click();
              }}
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

      {showCompleteConfirm && (
        <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-sm flex items-center justify-center p-4">
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
