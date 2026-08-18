"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type PendingJob = {
  jobId: string;
  reconciliationId?: string;
  entityId: string;
  clientId: string;
  startedAt: number;
};

type Toast = {
  id: string;
  message: string;
  href: string;
  type: "success" | "error";
};

const STORAGE_KEY = "cleartax_recon_pending";
const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour — matches backend cleanup

function readPendingJobs(): PendingJob[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingJob[];
    const cutoff = Date.now() - JOB_TTL_MS;
    return parsed.filter((j) => j.startedAt > cutoff);
  } catch {
    return [];
  }
}

function removeJob(jobId: string) {
  try {
    const jobs = readPendingJobs().filter((j) => j.jobId !== jobId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch { /* ignore */ }
}

function getToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)idToken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export default function ReconciliationJobMonitor() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const esRefs = useRef<Map<string, EventSource>>(new Map());
  const pollTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const jobs = readPendingJobs();
    if (jobs.length === 0) return;

    const token = getToken();

    const pushToast = (job: PendingJob, type: Toast["type"]) => {
      const entityHref = `/dashboard/accountant/clients/${job.clientId}/entities/${job.entityId}?tab=reconciliation`;
      setToasts((prev) => [
        ...prev,
        {
          id: job.jobId,
          message: type === "success" ? "Bank reconciliation complete!" : "Reconciliation failed.",
          href: entityHref,
          type,
        },
      ]);
    };

    // The stream dying is not a verdict — the pipeline usually keeps running
    // server-side. The reconciliation row in the DB is the source of truth, so
    // poll its status and only toast on a real done/error.
    const pollStatus = (job: PendingJob) => {
      if (!job.reconciliationId) {
        // Legacy entry without a reconciliation id — nothing to verify against,
        // so drop it silently rather than raise a false alarm.
        removeJob(job.jobId);
        return;
      }
      const check = async () => {
        pollTimers.current.delete(job.jobId);
        let status: string | null = null;
        try {
          const res = await fetch(
            `/api/entities/${encodeURIComponent(job.entityId)}/reconciliations/${encodeURIComponent(job.reconciliationId!)}`,
            { headers: token ? { Authorization: `Bearer ${token}` } : {} },
          );
          if (res.ok) {
            const detail = (await res.json()) as { status?: string };
            status = detail.status ?? null;
          }
        } catch { /* transient — retry below */ }

        if (status === "done" || status === "completed") {
          removeJob(job.jobId);
          pushToast(job, "success");
          return;
        }
        if (status === "error" || status === "failed") {
          removeJob(job.jobId);
          pushToast(job, "error");
          return;
        }
        if (Date.now() - job.startedAt > JOB_TTL_MS) {
          removeJob(job.jobId);
          return;
        }
        pollTimers.current.set(job.jobId, setTimeout(() => { void check(); }, 5000));
      };
      void check();
    };

    for (const job of jobs) {
      if (esRefs.current.has(job.jobId)) continue;

      const url = `/api/reconciliation/stream?job_id=${encodeURIComponent(job.jobId)}${token ? `&token=${encodeURIComponent(token)}` : ""}`;
      const es = new EventSource(url);
      esRefs.current.set(job.jobId, es);

      es.addEventListener("done", () => {
        es.close();
        esRefs.current.delete(job.jobId);
        removeJob(job.jobId);
        pushToast(job, "success");
      });

      // "error" fires both for a backend `event: error` (has .data — genuine
      // failure) and for any transport drop or 404 (no .data). Only the former
      // is failure; the latter gets verified against the DB.
      es.addEventListener("error", (e) => {
        es.close();
        esRefs.current.delete(job.jobId);
        if ((e as MessageEvent).data) {
          removeJob(job.jobId);
          pushToast(job, "error");
        } else {
          pollStatus(job);
        }
      });
    }

    const timers = pollTimers.current;
    const sources = esRefs.current;
    return () => {
      for (const es of sources.values()) es.close();
      sources.clear();
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 24,
      right: 24,
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      maxWidth: 340,
    }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            background: toast.type === "success" ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${toast.type === "success" ? "#86efac" : "#fca5a5"}`,
            borderRadius: 10,
            padding: "12px 16px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <svg viewBox="0 0 24 24" width={20} height={20} style={{ flexShrink: 0 }}
            stroke={toast.type === "success" ? "#16a34a" : "#dc2626"} fill="none" strokeWidth={2}>
            {toast.type === "success"
              ? <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>
              : <><circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/></>}
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1f2937" }}>{toast.message}</p>
            <Link
              href={toast.href}
              onClick={() => dismiss(toast.id)}
              style={{ fontSize: 12, color: "#2563eb", textDecoration: "underline" }}
            >
              View reconciliation →
            </Link>
          </div>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#6b7280" }}
          >
            <svg viewBox="0 0 24 24" width={14} height={14} stroke="currentColor" fill="none" strokeWidth={2}>
              <path d="M6 6l12 12M18 6 6 18"/>
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
