"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ReconciliationAccount,
  ReconciliationDetail,
  ReconciliationListItem,
  ReconciliationTransaction,
} from "@/src/lib/coreApi";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  entityId: string;
  token: string;
};

type Stage =
  | { type: "idle" }
  | { type: "uploading"; progress: number }
  | { type: "starting" }
  | { type: "streaming"; stage: string; pagesDone: number; pagesTotal: number; txSoFar: number }
  | { type: "done"; result: ReconciliationDetail }
  | { type: "error"; message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number | null, prefix = "") {
  if (v == null) return "—";
  return prefix + v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    done: "bg-green-100 text-green-800",
    processing: "bg-blue-100 text-blue-800",
    pending: "bg-gray-100 text-gray-600",
    error: "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AccountHeader({ account }: { account: ReconciliationAccount }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-4 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
      <div><span className="text-gray-500">Bank</span><span className="ml-2 font-medium">{account.bank}</span></div>
      <div><span className="text-gray-500">Account</span><span className="ml-2 font-medium font-mono">{account.accountNumber}</span></div>
      <div><span className="text-gray-500">Holder</span><span className="ml-2 font-medium">{account.holder}</span></div>
      <div><span className="text-gray-500">Type</span><span className="ml-2 capitalize">{account.accountType.replace("_", " ")}</span></div>
      <div><span className="text-gray-500">Period</span><span className="ml-2">{account.statementPeriod.from} → {account.statementPeriod.to}</span></div>
      <div>
        <span className="text-gray-500">Opening</span><span className="ml-2">{fmt(account.openingBalance, "$")}</span>
        <span className="text-gray-500 ml-4">Closing</span><span className="ml-2">{fmt(account.closingBalance, "$")}</span>
      </div>
    </div>
  );
}

function TransactionTable({ transactions }: { transactions: ReconciliationTransaction[] }) {
  const [search, setSearch] = useState("");
  const filtered = search
    ? transactions.filter(
        (t) =>
          t.description.toLowerCase().includes(search.toLowerCase()) ||
          (t.payee?.toLowerCase().includes(search.toLowerCase()) ?? false),
      )
    : transactions;

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <input
          type="text"
          placeholder="Search description or payee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-500">{filtered.length} transactions</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-2.5 text-left font-medium text-gray-600 w-28">Date</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">Description</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600 w-36">Payee</th>
              <th className="px-4 py-2.5 text-right font-medium text-gray-600 w-28">Debit</th>
              <th className="px-4 py-2.5 text-right font-medium text-gray-600 w-28">Credit</th>
              <th className="px-4 py-2.5 text-right font-medium text-gray-600 w-28">Balance</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs text-gray-600">{tx.date}</td>
                <td className="px-4 py-2 text-gray-800 max-w-xs truncate">{tx.description}</td>
                <td className="px-4 py-2 text-gray-600 text-xs">{tx.payee ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-2 text-right text-red-600 font-mono text-xs">
                  {tx.debit != null ? fmt(tx.debit) : ""}
                </td>
                <td className="px-4 py-2 text-right text-green-600 font-mono text-xs">
                  {tx.credit != null ? fmt(tx.credit) : ""}
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs text-gray-700">{fmt(tx.balance)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No transactions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryBar({ result }: { result: ReconciliationDetail }) {
  const s = result.summary;
  if (!s) return null;
  return (
    <div className="grid grid-cols-3 gap-4 mb-4">
      <div className="rounded-lg border border-gray-200 p-3 text-center">
        <div className="text-xl font-bold text-gray-800">{s.totalTransactions}</div>
        <div className="text-xs text-gray-500 mt-0.5">Transactions</div>
      </div>
      <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-center">
        <div className="text-xl font-bold text-red-700">{fmt(s.totalDebits, "$")}</div>
        <div className="text-xs text-red-400 mt-0.5">Total Debits</div>
      </div>
      <div className="rounded-lg border border-green-100 bg-green-50 p-3 text-center">
        <div className="text-xl font-bold text-green-700">{fmt(s.totalCredits, "$")}</div>
        <div className="text-xs text-green-400 mt-0.5">Total Credits</div>
      </div>
    </div>
  );
}

function ProgressBar({ stage, pagesDone, pagesTotal, txSoFar }: {
  stage: string; pagesDone: number; pagesTotal: number; txSoFar: number;
}) {
  const pct = pagesTotal > 0 ? Math.round((pagesDone / pagesTotal) * 100) : 0;
  const label: Record<string, string> = {
    downloading: "Downloading statement…",
    splitting: "Splitting into pages…",
    extracting: `Extracting transactions… (${pagesDone}/${pagesTotal} pages, ${txSoFar} found)`,
  };
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
      <div className="text-sm font-medium text-blue-800 mb-2">{label[stage] ?? stage}</div>
      <div className="w-full bg-blue-100 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {pagesTotal > 0 && (
        <div className="text-xs text-blue-600 mt-1">{pct}% complete</div>
      )}
    </div>
  );
}

// ── History list ──────────────────────────────────────────────────────────────

function HistoryList({
  items,
  onSelect,
}: {
  items: ReconciliationListItem[];
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-6">
      <div className="text-sm font-semibold text-gray-700 mb-2">Past reconciliations</div>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm hover:bg-gray-50 text-left w-full"
          >
            <div>
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold mr-2 ${statusBadge(item.status)}`}>
                {item.status}
              </span>
              <span className="text-gray-500 text-xs">{new Date(item.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
            <div className="text-right text-xs text-gray-500">
              {item.summary ? (
                <span>{item.summary.totalTransactions} transactions · {item.totalPages} pages</span>
              ) : (
                <span>{item.totalPages ? `${item.totalPages} pages` : ""}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BankReconciliation({ entityId, token }: Props) {
  const [stage, setStage] = useState<Stage>({ type: "idle" });
  const [history, setHistory] = useState<ReconciliationListItem[]>([]);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewDetail, setViewDetail] = useState<ReconciliationDetail | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load history on mount
  useEffect(() => {
    fetch(`/api/entities/${entityId}/reconciliations`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setHistory(data))
      .catch(() => {});
  }, [entityId, token]);

  // View a past reconciliation
  useEffect(() => {
    if (!viewingId) { setViewDetail(null); return; }
    fetch(`/api/entities/${entityId}/reconciliations/${viewingId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setViewDetail(data))
      .catch(() => {});
  }, [viewingId, entityId, token]);

  const connectSSE = useCallback((jobId: string) => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    const es = new EventSource(
      `/api/reconciliation/stream?job_id=${encodeURIComponent(jobId)}&token=${encodeURIComponent(token)}`,
    );
    eventSourceRef.current = es;

    es.addEventListener("status", (e) => {
      const d = JSON.parse(e.data);
      setStage({ type: "streaming", stage: d.stage, pagesDone: 0, pagesTotal: d.pages_total ?? 0, txSoFar: 0 });
    });

    es.addEventListener("progress", (e) => {
      const d = JSON.parse(e.data);
      setStage({ type: "streaming", stage: d.stage, pagesDone: d.pages_done, pagesTotal: d.pages_total, txSoFar: d.transactions_so_far });
    });

    es.addEventListener("done", (e) => {
      es.close();
      const result = JSON.parse(e.data) as ReconciliationDetail;
      setStage({ type: "done", result });
      // Refresh history
      fetch(`/api/entities/${entityId}/reconciliations`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => Array.isArray(data) && setHistory(data))
        .catch(() => {});
    });

    es.addEventListener("error", (e) => {
      es.close();
      const d = (e as MessageEvent).data ? JSON.parse((e as MessageEvent).data) : {};
      setStage({ type: "error", message: d.message ?? "Extraction failed" });
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) return;
      es.close();
      setStage({ type: "error", message: "Connection to server lost" });
    };
  }, [entityId, token]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(pdf)$/i)) {
      setStage({ type: "error", message: "Only PDF files are supported for bank statements" });
      return;
    }

    try {
      // 1. Presign
      setStage({ type: "uploading", progress: 0 });
      const presignRes = await fetch(
        `/api/documents/presign?filename=${encodeURIComponent(file.name)}&document_type=bank_statement&entity_id=${encodeURIComponent(entityId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!presignRes.ok) throw new Error("Failed to get upload URL");
      const { upload_url: uploadUrl, s3_key: s3Key } = await presignRes.json();

      // 2. Upload to S3
      setStage({ type: "uploading", progress: 30 });
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" },
      });
      if (!uploadRes.ok) throw new Error("S3 upload failed");
      setStage({ type: "uploading", progress: 100 });

      // 3. Start reconciliation
      setStage({ type: "starting" });
      const startRes = await fetch("/api/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ s3_key: s3Key, entity_id: entityId }),
      });
      if (!startRes.ok) throw new Error("Failed to start reconciliation");
      const { jobId } = await startRes.json();

      // 4. Stream progress
      setStage({ type: "streaming", stage: "downloading", pagesDone: 0, pagesTotal: 0, txSoFar: 0 });
      connectSSE(jobId);

    } catch (err) {
      setStage({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
    }
  }, [entityId, token, connectSSE]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const reset = () => {
    eventSourceRef.current?.close();
    setStage({ type: "idle" });
    setViewingId(null);
    setViewDetail(null);
  };

  // ── Viewing a past reconciliation ─────────────────────────────────────────
  if (viewingId && viewDetail) {
    return (
      <div>
        <button onClick={() => { setViewingId(null); setViewDetail(null); }} className="text-sm text-blue-600 hover:underline mb-4 flex items-center gap-1">
          ← Back
        </button>
        {viewDetail.account && <AccountHeader account={viewDetail.account} />}
        <SummaryBar result={viewDetail} />
        <TransactionTable transactions={viewDetail.transactions ?? []} />
      </div>
    );
  }

  // ── Result view ───────────────────────────────────────────────────────────
  if (stage.type === "done") {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-green-700">✓ Reconciliation complete</div>
          <button onClick={reset} className="text-xs text-gray-500 hover:underline">Upload another</button>
        </div>
        {stage.result.account && <AccountHeader account={stage.result.account} />}
        <SummaryBar result={stage.result} />
        <TransactionTable transactions={stage.result.transactions ?? []} />
      </div>
    );
  }

  // ── Upload / streaming UI ─────────────────────────────────────────────────
  return (
    <div>
      {/* Drop zone */}
      {(stage.type === "idle" || stage.type === "error") && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-10 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
        >
          <div className="text-3xl mb-3">📄</div>
          <div className="text-sm font-medium text-gray-700">Drop a bank statement PDF here</div>
          <div className="text-xs text-gray-400 mt-1">or click to browse · PDF only</div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {stage.type === "error" && (
            <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
              {stage.message}
            </div>
          )}
        </div>
      )}

      {/* Upload progress */}
      {stage.type === "uploading" && (
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-700 mb-2">Uploading…</div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${stage.progress}%` }} />
          </div>
        </div>
      )}

      {/* Starting */}
      {stage.type === "starting" && (
        <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-600">
          Starting extraction…
        </div>
      )}

      {/* SSE progress */}
      {stage.type === "streaming" && (
        <ProgressBar
          stage={stage.stage}
          pagesDone={stage.pagesDone}
          pagesTotal={stage.pagesTotal}
          txSoFar={stage.txSoFar}
        />
      )}

      <HistoryList items={history} onSelect={setViewingId} />
    </div>
  );
}
