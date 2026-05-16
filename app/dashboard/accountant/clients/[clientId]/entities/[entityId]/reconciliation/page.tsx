"use client";

import Link from "next/link";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { useParams, useSearchParams } from "next/navigation";
import type {
  CoreProperty,
  CoreTransactionListItem,
  ReconciliationDetail,
  ReconciliationListItem,
  ReconciliationMatch,
  ReconciliationTransaction,
} from "@/src/lib/coreApi";

// ── Auth helper ───────────────────────────────────────────────────────────────

function getToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)idToken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ReconciliationFilter = "all" | "matched";
type ReconciliationSort = "desc" | "asc";

type UploadStage =
  | { type: "idle" }
  | { type: "uploading"; progress: number }
  | { type: "starting" }
  | { type: "streaming"; stage: string; pagesDone: number; pagesTotal: number; txSoFar: number }
  | { type: "error"; message: string };

type MatchUpdate = ReconciliationMatch | { remove: number };

// ── Pure helpers (outside component — no hooks) ────────────────────────────────

function computeCandidateMatches(
  bankTxs: ReconciliationTransaction[],
  entityTxs: CoreTransactionListItem[],
): Map<number, CoreTransactionListItem[]> {
  const map = new Map<number, CoreTransactionListItem[]>();
  bankTxs.forEach((bankTx, i) => {
    const amount = bankTx.debit ?? bankTx.credit;
    if (amount == null) return;
    const type = bankTx.debit != null ? "expense" : "revenue";
    const hits = entityTxs.filter(
      (t) =>
        t.type === type && Math.abs(Math.abs(t.grossAmount) - amount) <= 0.02,
    );
    if (hits.length) map.set(i, hits);
  });
  return map;
}

function matchReducer(
  current: Map<number, ReconciliationMatch>,
  update: MatchUpdate,
): Map<number, ReconciliationMatch> {
  const next = new Map(current);
  if ("remove" in update) {
    next.delete(update.remove);
  } else {
    next.set(update.bankTxIndex, update);
  }
  return next;
}

function fmtAud(v: number | null | undefined): string {
  if (v == null) return "—";
  return `$${Math.abs(v).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`;
}

function shortId(id: string): string {
  return `TXN-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AccountantReconciliationPage() {
  const params = useParams<{ clientId: string; entityId: string }>();
  const searchParams = useSearchParams();
  const clientId = String(params?.clientId ?? "");
  const entityId = String(params?.entityId ?? "");

  // Past reconciliations
  const [history, setHistory] = useState<ReconciliationListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Currently viewed reconciliation detail
  const [activeRecon, setActiveRecon] = useState<ReconciliationDetail | null>(null);
  const [activeReconLoading, setActiveReconLoading] = useState(false);

  // Upload flow state
  const [uploadStage, setUploadStage] = useState<UploadStage>({ type: "idle" });
  const [hasImported, setHasImported] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // History panel selection
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  // ── Matching state ────────────────────────────────────────────────────────

  const [entityTxs, setEntityTxs] = useState<CoreTransactionListItem[]>([]);
  const [entityTxsLoading, setEntityTxsLoading] = useState(false);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [confirmedMatches, setConfirmedMatches] = useState<Map<number, ReconciliationMatch>>(new Map());
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [properties, setProperties] = useState<CoreProperty[]>([]);
  const [assignedProperties, setAssignedProperties] = useState<Map<number, string>>(new Map());
  const [reconPage, setReconPage] = useState(1);
  const RECON_PAGE_SIZE = 20;

  // Table filter/sort state
  const [activeTab, setActiveTab] = useState<"unreviewed" | "reviewed">("unreviewed");
  const [filter, setFilter] = useState<ReconciliationFilter>("all");
  const [query, setQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<ReconciliationSort>("desc");

  // React 19: optimistic UI for match confirmations
  const [optimisticMatches, addOptimisticMatch] = useOptimistic<
    Map<number, ReconciliationMatch>,
    MatchUpdate
  >(confirmedMatches, matchReducer);

  // React 19: non-blocking transitions for match writes
  const [isPending, startTransition] = useTransition();

  // React 19: deferred entity txs so bank table renders immediately
  const deferredEntityTxs = useDeferredValue(entityTxs);

  // ── Data fetching ─────────────────────────────────────────────────────────

  // Load entity properties on mount for the property dropdown
  useEffect(() => {
    const token = getToken();
    fetch(`/api/entities/${entityId}/properties`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: CoreProperty[] }) => setProperties(data.items ?? []))
      .catch(() => {});
  }, [entityId]);

  // Load past reconciliations list on mount
  useEffect(() => {
    const token = getToken();
    setHistoryLoading(true);
    fetch(`/api/entities/${entityId}/reconciliations`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ReconciliationListItem[]) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [entityId]);

  // When activeRecon is set, fire entity txs + confirmed matches fetches in parallel
  // Each updates its own state independently — table renders immediately with available data
  useEffect(() => {
    if (!activeRecon?.id) return;
    const token = getToken();
    const reconId = activeRecon.id;

    setEntityTxsLoading(true);
    fetch(`/api/entities/${entityId}/transactions`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: CoreTransactionListItem[] }) => setEntityTxs(data.items ?? []))
      .catch(() => setEntityTxs([]))
      .finally(() => setEntityTxsLoading(false));

    setMatchesLoading(true);
    fetch(`/api/entities/${entityId}/reconciliations/${reconId}/matches`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ReconciliationMatch[]) => {
        const map = new Map<number, ReconciliationMatch>();
        for (const m of data) map.set(m.bankTxIndex, m);
        setConfirmedMatches(map);
      })
      .catch(() => setConfirmedMatches(new Map()))
      .finally(() => setMatchesLoading(false));
  }, [activeRecon?.id, entityId]);

  const reloadMatches = useCallback(async () => {
    if (!activeRecon?.id) return;
    const token = getToken();
    const res = await fetch(
      `/api/entities/${entityId}/reconciliations/${activeRecon.id}/matches`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (res.ok) {
      const data = (await res.json()) as ReconciliationMatch[];
      const map = new Map<number, ReconciliationMatch>();
      for (const m of data) map.set(m.bankTxIndex, m);
      setConfirmedMatches(map);
    }
  }, [activeRecon?.id, entityId]);

  // Load a specific reconciliation's detail
  const loadReconciliation = useCallback(
    (id: string) => {
      const token = getToken();
      setActiveReconLoading(true);
      fetch(`/api/entities/${entityId}/reconciliations/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: ReconciliationDetail | null) => {
          if (data) {
            setActiveRecon(data);
            setHasImported(true);
            setFeedbackMessage("Statement loaded.");
          }
        })
        .catch(() => setFeedbackMessage("Failed to load reconciliation."))
        .finally(() => setActiveReconLoading(false));
    },
    [entityId],
  );

  // Auto-load via ?id= param
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) loadReconciliation(id);
  }, [searchParams, loadReconciliation]);

  const refreshHistory = useCallback(() => {
    const token = getToken();
    fetch(`/api/entities/${entityId}/reconciliations`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ReconciliationListItem[]) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [entityId]);

  // SSE connection (unchanged from original)
  const connectSSE = useCallback(
    (jobId: string) => {
      const token = getToken();
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
        const summaryRaw = (raw.summary ?? raw.Summary) as Record<string, unknown> | null;
        const accountRaw = (raw.account ?? raw.Account) as Record<string, unknown> | null;
        const txRaw = Array.isArray(raw.transactions) ? (raw.transactions as Record<string, unknown>[]) : [];
        const normalized: ReconciliationDetail = {
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
        setActiveRecon(normalized);
        setUploadStage({ type: "idle" });
        setHasImported(true);
        setFeedbackMessage("Bank statement extracted successfully.");
        try {
          const stored = JSON.parse(localStorage.getItem("cleartax_recon_pending") ?? "[]") as Array<{ jobId: string }>;
          localStorage.setItem("cleartax_recon_pending", JSON.stringify(stored.filter((j) => j.jobId !== jobId)));
        } catch { /* ignore */ }
        refreshHistory();
      });

      es.addEventListener("error", (e) => {
        es.close();
        const d = (e as MessageEvent).data ? JSON.parse((e as MessageEvent).data) : {};
        setUploadStage({ type: "error", message: d.message ?? "Extraction failed. Please try again." });
        refreshHistory();
      });

      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) return;
        es.close();
        setUploadStage({ type: "error", message: "Connection lost. Please try again." });
      };
    },
    [refreshHistory],
  );

  // File upload handler (unchanged)
  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.match(/\.pdf$/i)) {
        setUploadStage({ type: "error", message: "Only PDF files are supported." });
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
        const uploadRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": "application/pdf" } });
        if (!uploadRes.ok) throw new Error("Upload to storage failed");
        setUploadStage({ type: "uploading", progress: 90 });

        setUploadStage({ type: "starting" });
        const startRes = await fetch("/api/reconciliation", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ s3_key: s3Key, entity_id: entityId }),
        });
        if (!startRes.ok) throw new Error("Failed to start reconciliation");
        const { jobId } = await startRes.json();

        try {
          const stored = JSON.parse(localStorage.getItem("cleartax_recon_pending") ?? "[]") as unknown[];
          stored.push({ jobId, entityId, clientId, startedAt: Date.now() });
          localStorage.setItem("cleartax_recon_pending", JSON.stringify(stored));
        } catch { /* ignore */ }

        setUploadStage({ type: "streaming", stage: "downloading", pagesDone: 0, pagesTotal: 0, txSoFar: 0 });
        connectSSE(jobId);
      } catch (err) {
        setUploadStage({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
      }
    },
    [entityId, clientId, connectSSE],
  );

  // ── Match actions (React 19 optimistic + transition) ──────────────────────

  function doConfirmMatch(bankTxIndex: number, candidate: CoreTransactionListItem) {
    if (!activeRecon) return;
    const optimistic: ReconciliationMatch = {
      id: "",
      reconciliationId: activeRecon.id,
      bankTxIndex,
      transactionId: candidate.id,
      status: "confirmed",
      confirmedBy: "",
      confirmedAt: new Date().toISOString(),
    };
    startTransition(async () => {
      addOptimisticMatch(optimistic);
      try {
        await fetch(
          `/api/entities/${entityId}/reconciliations/${activeRecon.id}/matches`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify({ bankTxIndex, transactionId: candidate.id, status: "confirmed" }),
          },
        );
        await reloadMatches();
        setExpandedIndex(null);
      } catch { /* optimistic rolls back automatically */ }
    });
  }

  function doExcludeMatch(bankTxIndex: number) {
    if (!activeRecon) return;
    const optimistic: ReconciliationMatch = {
      id: "",
      reconciliationId: activeRecon.id,
      bankTxIndex,
      transactionId: null,
      status: "excluded",
      confirmedBy: "",
      confirmedAt: new Date().toISOString(),
    };
    startTransition(async () => {
      addOptimisticMatch(optimistic);
      try {
        await fetch(
          `/api/entities/${entityId}/reconciliations/${activeRecon.id}/matches`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify({ bankTxIndex, transactionId: null, status: "excluded" }),
          },
        );
        await reloadMatches();
        setExpandedIndex(null);
      } catch { /* optimistic rolls back automatically */ }
    });
  }

  function doUndoMatch(bankTxIndex: number) {
    if (!activeRecon) return;
    startTransition(async () => {
      addOptimisticMatch({ remove: bankTxIndex });
      try {
        await fetch(
          `/api/entities/${entityId}/reconciliations/${activeRecon.id}/matches?bankTxIndex=${bankTxIndex}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } },
        );
        await reloadMatches();
      } catch { /* optimistic rolls back */ }
    });
  }

  // ── Upload panel helpers ──────────────────────────────────────────────────

  function importSelected() {
    if (selectedHistoryIds.length === 0) return;
    const id = selectedHistoryIds[selectedHistoryIds.length - 1];
    loadReconciliation(id);
    setSelectedHistoryIds([]);
    setFeedbackMessage(`Loading ${selectedHistoryIds.length} statement${selectedHistoryIds.length > 1 ? "s" : ""}…`);
  }

  function toggleSelect(id: string) {
    setSelectedHistoryIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }

  function openUploadArea() {
    setHasImported(false);
    setActiveRecon(null);
    setFeedbackMessage("");
    setUploadStage({ type: "idle" });
    setEntityTxs([]);
    setConfirmedMatches(new Map());
    setExpandedIndex(null);
    eventSourceRef.current?.close();
  }

  function uploadStageLabel(): string {
    if (uploadStage.type === "uploading") return `Uploading… ${uploadStage.progress}%`;
    if (uploadStage.type === "starting") return "Starting extraction…";
    if (uploadStage.type === "streaming") {
      const m: Record<string, string> = {
        downloading: "Downloading statement…",
        splitting: "Splitting pages…",
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

  // ── Derived data (inline computation with deferred entity txs) ─────────────

  const allBankTxs = activeRecon?.transactions ?? [];
  const summary = activeRecon?.summary ?? null;
  const account = activeRecon?.account ?? null;

  // candidateMatches uses deferredEntityTxs so the table renders immediately
  // even while entity txs are still loading — badges appear once data settles
  const candidateMatches = computeCandidateMatches(allBankTxs, deferredEntityTxs);

  const reconciledCount = Array.from(optimisticMatches.values()).filter((m) => m.status === "confirmed").length;
  const excludedCount = Array.from(optimisticMatches.values()).filter((m) => m.status === "excluded").length;

  const q = query.trim().toLowerCase();

  const visibleRows = allBankTxs
    .map((row, i) => ({ row, i }))
    .filter(({ row, i }) => {
      const match = optimisticMatches.get(i);
      const isResolved = match != null;

      if (activeTab === "reviewed") return isResolved;
      if (isResolved) return false;

      if (filter === "matched" && !candidateMatches.has(i)) return false;
      if (q && !row.description.toLowerCase().includes(q) && !(row.payee?.toLowerCase().includes(q) ?? false)) return false;
      return true;
    })
    .sort((a, b) => {
      const at = new Date(a.row.date).getTime();
      const bt = new Date(b.row.date).getTime();
      return sortDirection === "desc" ? bt - at : at - bt;
    });

  const reconTotalPages = Math.max(1, Math.ceil(visibleRows.length / RECON_PAGE_SIZE));
  const pagedReconRows = visibleRows.slice((reconPage - 1) * RECON_PAGE_SIZE, reconPage * RECON_PAGE_SIZE);

  const unreviewedCount = allBankTxs.length - reconciledCount - excludedCount;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="accountant-reconciliation-page">
      <Link
        href={`/dashboard/accountant/clients/${clientId}/entities/${entityId}`}
        className="accountant-back-link"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
          <path d="M9 12h10" />
        </svg>
        Back to Entity
      </Link>

      <div className="accountant-reconciliation-title">
        <h1>Bank Reconciliation</h1>
        {hasImported && (
          <button type="button" className="accountant-reconciliation-upload-button" onClick={openUploadArea}>
            <UploadIcon />
            Upload Document
          </button>
        )}
      </div>

      {/* ── Upload / history selection panel ────────────────────────────── */}
      {!hasImported ? (
        <div className="accountant-reconciliation-import-grid">
          <section className="accountant-upload-statement-card">
            <div>
              <span><UploadIcon /></span>
              <h2>Upload Bank Statement</h2>
              <p>Upload a new bank statement PDF to begin reconciliation</p>

              {isProcessing ? (
                <div style={{ width: "100%" }}>
                  <p style={{ fontSize: 13, color: "#4b5563", marginBottom: 8 }}>{uploadStageLabel()}</p>
                  <div style={{ background: "#e5e7eb", borderRadius: 9999, height: 8 }}>
                    <div style={{ background: "#3b82f6", borderRadius: 9999, height: 8, width: `${processingPct}%`, transition: "width 0.3s" }} />
                  </div>
                </div>
              ) : (
                <>
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={isProcessing}>
                    <UploadIcon />
                    Add Bank Statement
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf"
                    style={{ display: "none" }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
                  />
                  <small>Supports PDF files only</small>
                </>
              )}
              {uploadStage.type === "error" && (
                <p style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>{uploadStage.message}</p>
              )}
            </div>
          </section>

          <section className="accountant-existing-documents-card">
            <div className="accountant-existing-documents-head">
              <div>
                <h2>Choose from Existing Statements</h2>
                <p>Select a previously processed bank statement</p>
              </div>
              {selectedHistoryIds.length > 0 && <span>{selectedHistoryIds.length} selected</span>}
            </div>

            {historyLoading ? (
              <div className="accountant-document-empty-state"><strong>Loading…</strong></div>
            ) : history.length === 0 ? (
              <div className="accountant-document-empty-state">
                <DocumentIcon />
                <strong>No bank statements found</strong>
                <p>Upload a bank statement to begin reconciliation.</p>
              </div>
            ) : (
              <div className="accountant-document-select-list">
                {history.map((item) => {
                  const selected = selectedHistoryIds.includes(item.id);
                  const date = new Date(item.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
                  const txCount = item.summary?.totalTransactions ?? "—";
                  const pages = item.totalPages ? `${item.totalPages} pages` : "";
                  return (
                    <button key={item.id} type="button" className={selected ? "is-selected" : ""} onClick={() => toggleSelect(item.id)}>
                      <span className="accountant-checkbox-fake">{selected ? "✓" : ""}</span>
                      <DocumentIcon />
                      <strong>
                        Bank Statement · {date}
                        <em>{txCount} transactions{pages ? ` · ${pages}` : ""}{` · ${item.status}`}</em>
                      </strong>
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              className="accountant-import-documents-button"
              disabled={selectedHistoryIds.length === 0 || activeReconLoading}
              onClick={importSelected}
            >
              {activeReconLoading
                ? "Loading…"
                : selectedHistoryIds.length > 0
                  ? `Open ${selectedHistoryIds.length} Selected Statement${selectedHistoryIds.length > 1 ? "s" : ""}`
                  : "Select a Statement"}
            </button>
          </section>
        </div>
      ) : (
        <>
          {feedbackMessage && (
            <div className="accountant-reconciliation-feedback" role="status">{feedbackMessage}</div>
          )}

          {/* ── Active statement header ─────────────────────────────────── */}
          <section className="accountant-uploaded-statements-card">
            <div className="accountant-existing-documents-head">
              <h2>Active Statement</h2>
              <button type="button" onClick={openUploadArea}>+ Add Statement</button>
            </div>

            {activeReconLoading ? (
              <div className="accountant-document-empty-state is-inline"><strong>Loading…</strong></div>
            ) : !activeRecon ? (
              <div className="accountant-document-empty-state is-inline">
                <DocumentIcon />
                <strong>No statement loaded</strong>
                <p>Upload or select a bank statement above.</p>
              </div>
            ) : (
              <article>
                <DocumentIcon />
                <div>
                  <strong>{account?.bank ? `${account.bank} — ${account.holder}` : "Bank Statement"}</strong>
                  <span>
                    {account?.statementPeriod
                      ? `${account.statementPeriod.from} → ${account.statementPeriod.to}`
                      : new Date(activeRecon.createdAt).toLocaleDateString("en-AU")}
                    {` · ${summary?.totalTransactions ?? 0} transactions`}
                    {activeRecon.totalPages ? ` · ${activeRecon.totalPages} pages` : ""}
                  </span>
                </div>
                <p>
                  <strong>{account?.closingBalance != null ? fmtAud(account.closingBalance) : "—"}</strong>
                  <span>Closing Balance</span>
                </p>
              </article>
            )}
          </section>

          {/* ── KPI cards ────────────────────────────────────────────────── */}
          <div className="accountant-reconciliation-kpis">
            <article>
              <div><span>Total Debits</span></div>
              <strong>{summary ? fmtAud(summary.totalDebits) : "—"}</strong>
              <small>{account ? `Opening: ${fmtAud(account.openingBalance)}` : ""}</small>
            </article>
            <article>
              <span>Transactions</span>
              <strong>{summary?.totalTransactions ?? allBankTxs.length}</strong>
              <small>
                {activeRecon?.totalPages
                  ? `${activeRecon.totalPages - (activeRecon.summary?.pagesSkipped ?? 0)} pages processed`
                  : ""}
              </small>
            </article>
            <article>
              <span>Total Credits</span>
              <strong className="is-good-text">{summary ? fmtAud(summary.totalCredits) : "—"}</strong>
              <small>{account ? `Closing: ${fmtAud(account.closingBalance)}` : ""}</small>
            </article>
            <article className="recon-kpi-reconciled">
              <span>Reconciled</span>
              <strong>
                {matchesLoading
                  ? <span className="recon-shimmer" style={{ width: 40, height: 28, display: "inline-block" }} />
                  : `${reconciledCount} / ${allBankTxs.length}`}
              </strong>
              <small>{excludedCount > 0 ? `${excludedCount} excluded` : "Confirm matches below"}</small>
            </article>
          </div>

          {/* ── Filter / tab bar ─────────────────────────────────────────── */}
          <section className="accountant-reconciliation-filter-card">
            <div className="accountant-reconciliation-tabs">
              <button
                type="button"
                className={activeTab === "unreviewed" ? "is-active" : ""}
                onClick={() => { setActiveTab("unreviewed"); setFilter("all"); setReconPage(1); }}
              >
                Transactions ({unreviewedCount})
              </button>
              <button
                type="button"
                className={activeTab === "reviewed" ? "is-active" : ""}
                onClick={() => { setActiveTab("reviewed"); setFilter("all"); setReconPage(1); }}
              >
                Reconciled ({reconciledCount + excludedCount})
              </button>
            </div>
            <div className="accountant-reconciliation-controls">
              <label>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m16 16 4 4" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by payee or description…"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setReconPage(1); }}
                />
              </label>
              {activeTab === "unreviewed" && (
                <>
                  <button
                    type="button"
                    className={filter === "all" ? "is-active" : ""}
                    onClick={() => { setFilter("all"); setReconPage(1); }}
                  >
                    All ({unreviewedCount})
                  </button>
                  <button
                    type="button"
                    className={filter === "matched" ? "is-active" : ""}
                    onClick={() => { setFilter("matched"); setReconPage(1); }}
                  >
                    Matched ({entityTxsLoading ? "…" : candidateMatches.size})
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => { setSortDirection((cur) => (cur === "desc" ? "asc" : "desc")); setReconPage(1); }}
              >
                Sort: Date {sortDirection === "desc" ? "↓" : "↑"}
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </button>
            </div>
          </section>

          {/* ── Transaction table ─────────────────────────────────────────── */}
          <section className="accountant-reconciliation-table">
            {/* Table head */}
            <div className="accountant-reconciliation-table-head">
              <span>Date &amp; Payee</span>
              <span>Property</span>
              <span>Category</span>
              <span>Expense</span>
              <span>Income</span>
              <span>Action</span>
            </div>

            {activeReconLoading ? (
              <div className="accountant-reconciliation-table-empty">
                <strong>Loading statement…</strong>
              </div>
            ) : visibleRows.length === 0 ? (
              <div className="accountant-reconciliation-table-empty">
                <strong>
                  {activeTab === "reviewed"
                    ? "No reconciled transactions yet."
                    : allBankTxs.length === 0
                      ? "No transactions in this statement."
                      : "No transactions match these filters."}
                </strong>
                {activeTab === "unreviewed" && allBankTxs.length > 0 && (
                  <span>Try changing the search or filter.</span>
                )}
              </div>
            ) : (
              pagedReconRows.map(({ row, i }) => {
                const matchEntry = optimisticMatches.get(i);
                const isConfirmed = matchEntry?.status === "confirmed";
                const isExcluded = matchEntry?.status === "excluded";
                const candidates = candidateMatches.get(i) ?? [];
                const hasCandidates = candidates.length > 0;
                const isExpanded = expandedIndex === i;

                // Find the matched entity tx for confirmed rows
                const matchedTx = isConfirmed && matchEntry?.transactionId
                  ? entityTxs.find((t) => t.id === matchEntry.transactionId) ?? null
                  : null;

                // Property cell content
                const propertyDisplay = entityTxsLoading ? (
                  <span className="recon-shimmer" />
                ) : isConfirmed && matchedTx ? (
                  matchedTx.propertyNames[0]
                    ? <Link href={`/dashboard/accountant/clients/${clientId}/entities/${entityId}/properties/${matchedTx.propertyIds[0]}`} className="is-link">{matchedTx.propertyNames[0]}</Link>
                    : <span className="is-muted">Not assigned</span>
                ) : (
                  <select
                    className="recon-property-select"
                    value={assignedProperties.get(i) ?? ""}
                    onChange={(e) => {
                      setAssignedProperties((prev) => {
                        const next = new Map(prev);
                        if (e.target.value) next.set(i, e.target.value);
                        else next.delete(i);
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

                // Category cell content
                const categoryDisplay = entityTxsLoading ? (
                  <span className="recon-shimmer" />
                ) : isConfirmed && matchedTx ? (
                  <>
                    <strong>{matchedTx.categoryName}</strong>
                    <small>{matchedTx.subcategoryName}</small>
                    <em>Matched</em>
                  </>
                ) : isExcluded ? (
                  <>
                    <strong>Excluded</strong>
                  </>
                ) : hasCandidates ? (
                  <>
                    <strong>Uncategorized</strong>
                    <mark className="is-warning">Categorize</mark>
                  </>
                ) : (
                  <>
                    <strong>Uncategorized</strong>
                    <mark className="is-warning">Categorize</mark>
                  </>
                );

                // Action cell content
                let actionCell: import("react").ReactNode;
                if (matchesLoading) {
                  actionCell = <span className="recon-shimmer" style={{ width: 90 }} />;
                } else if (isConfirmed) {
                  actionCell = (
                    <div className="recon-action-confirmed">
                      <span className="recon-reconciled-badge">Reconciled</span>
                      <button type="button" className="recon-undo-btn" disabled={isPending} onClick={() => doUndoMatch(i)}>
                        Undo
                      </button>
                    </div>
                  );
                } else if (isExcluded) {
                  actionCell = (
                    <div className="recon-action-confirmed">
                      <span className="recon-excluded-badge">Excluded</span>
                      <button type="button" className="recon-undo-btn" disabled={isPending} onClick={() => doUndoMatch(i)}>
                        Undo
                      </button>
                    </div>
                  );
                } else if (hasCandidates) {
                  actionCell = (
                    <button
                      type="button"
                      onClick={() => setExpandedIndex(isExpanded ? null : i)}
                    >
                      {isExpanded ? "Hide Matches" : "Review Match"}
                    </button>
                  );
                } else {
                  actionCell = <span style={{ color: "#d0d5dd" }}>—</span>;
                }

                return (
                  <div
                    key={i}
                    className={[
                      "recon-row-wrapper",
                      isConfirmed ? "recon-row-wrapper--confirmed" : "",
                      isExcluded ? "recon-row-wrapper--excluded" : "",
                      isExpanded ? "recon-row-wrapper--expanded" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    {/* Main row */}
                    <div className="accountant-reconciliation-table-row">
                      {/* Status icon */}
                      <div className="accountant-reconciliation-status-cell">
                        <span className={isConfirmed || isExcluded ? "" : "is-alert"}>
                          {isConfirmed ? "✓" : "!"}
                        </span>
                      </div>

                      {/* Date & Payee */}
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

                      {/* Property */}
                      <div>{propertyDisplay}</div>

                      {/* Category */}
                      <div>{categoryDisplay}</div>

                      {/* Expense */}
                      <strong style={{ color: row.debit != null ? "#dc2626" : undefined }}>
                        {row.debit != null ? `-${fmtAud(row.debit)}` : "—"}
                      </strong>

                      {/* Income */}
                      <strong className={row.credit != null ? "is-good-text" : ""}>
                        {row.credit != null ? fmtAud(row.credit) : "—"}
                      </strong>

                      {/* Action */}
                      {actionCell}
                    </div>

                    {/* Expand panel — candidate match cards */}
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
                                disabled={isPending}
                                onClick={() => doConfirmMatch(i, candidate)}
                              >
                                {isPending ? "Saving…" : "Confirm Match"}
                              </button>
                              <button
                                type="button"
                                className="recon-exclude-btn"
                                disabled={isPending}
                                onClick={() => doExcludeMatch(i)}
                              >
                                Exclude
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>

          {/* ── Footer ────────────────────────────────────────────────────── */}
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
            <div>
              <button
                type="button"
                onClick={() => {
                  if (!activeRecon?.transactions?.length) return;
                  const headers = ["date", "payee", "description", "debit", "credit", "balance", "reconciled"];
                  const csv = [
                    headers.join(","),
                    ...visibleRows.map(({ row, i }) => {
                      const m = optimisticMatches.get(i);
                      return [
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
                  a.download = `reconciliation-${activeRecon.id}.csv`;
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
              <button
                type="button"
                onClick={() => setFeedbackMessage("Reconciliation marked complete.")}
              >
                Complete Reconciliation
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
