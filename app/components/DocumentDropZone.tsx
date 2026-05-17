"use client";

import { useRef, useState } from "react";
import Lottie from "lottie-react";
import {
  upsertDocumentProcessingJob,
  type DocumentProcessingScope,
  type DocumentProcessingStatus,
} from "@/app/components/documentProcessingStore";
import transactionDocumentSuccessAnimation from "@/public/lottie/transaction-document-success.json";

export type ExtractedDocumentData = {
  type?: string;
  title?: string;
  description?: string;
  vendor?: string;
  payer?: string;
  amount?: number;
  currency?: string;
  gst_included?: boolean;
  gst_amount?: number;
  date?: string;
  due_date?: string;
  reference?: string;
};

type Status =
  | "idle"
  | "dragover"
  | "uploading"
  | "extracting"
  | "done"
  | "error";

const ALLOWED_EXT = [".pdf", ".png", ".jpg", ".jpeg"];
const ACCEPT_ATTR = ALLOWED_EXT.join(",");

export function DocumentDropZone({
  token,
  onExtracted,
  scope,
}: {
  token: string | null;
  onExtracted: (
    data: ExtractedDocumentData,
    documentId: string,
    meta?: { filename: string; jobId: string },
  ) => void;
  scope?: DocumentProcessingScope;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [queueTotal, setQueueTotal] = useState(0);
  const [queueDone, setQueueDone] = useState(0);

  const busy = status === "uploading" || status === "extracting";

  function pickFile() {
    if (busy) return;
    inputRef.current?.click();
  }

  function updateStatus(
    nextStatus: Status,
    nextProgress: number,
    nextFilename: string,
    jobId?: string,
    href?: string,
  ) {
    setStatus(nextStatus);
    setProgress(nextProgress);
    if (jobId) {
      upsertDocumentProcessingJob({
        id: jobId,
        filename: nextFilename,
        status: nextStatus as DocumentProcessingStatus,
        progress: nextProgress,
        href: href ?? documentReviewHref(jobId),
        scope,
      });
    }
  }

  async function handleFile(file: File, index = 0, total = 1) {
    if (!token) {
      setError("Not authenticated yet");
      setStatus("error");
      return;
    }

    const lowered = file.name.toLowerCase();
    const ext = lowered.match(/\.[^.]+$/)?.[0] ?? "";
    if (!ALLOWED_EXT.includes(ext)) {
      setError("Only PDF, PNG, JPG, JPEG files are supported");
      setStatus("error");
      return;
    }

    const jobId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${index}-${file.name}`;
    const href = documentReviewHref(jobId);
    setFilename(file.name);
    setError("");
    setQueueTotal(total);
    setProgress(0);
    upsertDocumentProcessingJob({
      id: jobId,
      filename: file.name,
      status: "queued",
      progress: 0,
      href,
      scope,
    });

    try {
      updateStatus("uploading", 8, file.name, jobId, href);
      const presignParams = new URLSearchParams({
        filename: file.name,
        document_type: "transaction",
      });
      if (scope?.entityId) presignParams.set("entity_id", scope.entityId);
      const presignRes = await fetch(
        `/api/documents/presign?${presignParams.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!presignRes.ok) {
        const body = await safeJson(presignRes);
        throw new Error(
          body.message || body.error || `Presign failed (${presignRes.status})`,
        );
      }
      const {
        upload_url,
        s3_key,
        document_id,
      } = (await presignRes.json()) as {
        upload_url: string;
        s3_key: string;
        document_id: string;
      };
      upsertDocumentProcessingJob({
        id: jobId,
        filename: file.name,
        documentId: document_id,
        status: "uploading",
        progress: 20,
        href,
        scope,
      });
      setProgress(20);

      const putRes = await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`Upload to S3 failed (${putRes.status})`);
      }

      updateStatus("extracting", 62, file.name, jobId, href);
      const progressTimer = window.setInterval(() => {
        setProgress((current) => {
          if (current >= 94) return current;
          const next = current + (current < 80 ? 4 : 1);
          upsertDocumentProcessingJob({
            id: jobId,
            filename: file.name,
            documentId: document_id,
            status: "extracting",
            progress: next,
            href,
            scope,
          });
          return next;
        });
      }, 650);
      const extractRes = await fetch("/api/documents/extract", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ s3_key }),
      }).finally(() => window.clearInterval(progressTimer));
      if (!extractRes.ok) {
        const body = await safeJson(extractRes);
        throw new Error(
          body.message || body.error || `Extract failed (${extractRes.status})`,
        );
      }
      const result = (await extractRes.json()) as {
        success: boolean;
        data: ExtractedDocumentData;
      };

      if (total === 1) {
        onExtracted(result.data ?? {}, document_id, {
          filename: file.name,
          jobId,
        });
      }
      upsertDocumentProcessingJob({
        id: jobId,
        filename: file.name,
        documentId: document_id,
        status: "done",
        progress: 100,
        data: result.data ?? {},
        href,
        scope,
      });
      setProgress(100);
      setStatus("done");
      setQueueDone((current) => Math.min(total, current + 1));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Document processing failed";
      setError(message);
      setStatus("error");
      setProgress(0);
      upsertDocumentProcessingJob({
        id: jobId,
        filename: file.name,
        status: "error",
        progress: 0,
        error: message,
        href,
        scope,
      });
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) handleFiles(files);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (busy) return;
    setStatus((s) => (s === "dragover" ? "idle" : s));
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) handleFiles(files);
  }

  async function handleFiles(files: File[]) {
    setQueueTotal(files.length);
    setQueueDone(0);
    for (let index = 0; index < files.length; index += 1) {
      await handleFile(files[index], index, files.length);
    }
  }

  function onDragOver(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
  }

  function onDragEnter(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (busy) return;
    setStatus((s) => (s === "idle" || s === "done" || s === "error" ? "dragover" : s));
  }

  function onDragLeave() {
    setStatus((s) => (s === "dragover" ? "idle" : s));
  }

  const showProgress = status === "uploading" || status === "extracting";

  return (
    <div className="transaction-document-drop-wrap">
      <button
        type="button"
        className="transaction-document-drop"
        onClick={pickFile}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        disabled={busy}
        data-status={status}
        aria-busy={busy}
      >
        {showProgress ? (
          <span className="transaction-document-drop__progress" />
        ) : null}
        {showProgress ? (
          <span
            className="transaction-document-drop__circle"
            style={
              {
                "--progress": `${progress}%`,
              } as React.CSSProperties
            }
            aria-label={`${progress}% complete`}
          >
            <b>{progress}%</b>
          </span>
        ) : status === "done" ? (
          <span className="transaction-document-drop__lottie" aria-hidden="true">
            <Lottie
              animationData={transactionDocumentSuccessAnimation}
              loop={false}
            />
          </span>
        ) : (
          <span>{iconForStatus(status)}</span>
        )}
        <strong>{primaryLabel(status, filename)}</strong>
        <small>{secondaryLabel(status, error)}</small>
        {filename && (status === "uploading" || status === "extracting" || status === "done") ? (
          <span className="transaction-document-drop__caption">
            {filename}
            {queueTotal > 1 ? ` (${Math.min(queueDone + 1, queueTotal)} of ${queueTotal})` : ""}
          </span>
        ) : null}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        style={{ display: "none" }}
        onChange={onChange}
      />
    </div>
  );
}

function documentReviewHref(jobId: string) {
  if (typeof window === "undefined") {
    return `/dashboard/accountant/transactions/new?reviewDocument=${encodeURIComponent(jobId)}`;
  }
  const url = new URL(window.location.href);
  url.searchParams.set("reviewDocument", jobId);
  return `${url.pathname}${url.search}${url.hash}`;
}

function iconForStatus(status: Status) {
  switch (status) {
    case "uploading":
      return (
        <svg
          className="is-spinner"
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
        >
          <circle cx="12" cy="12" r="9" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" />
        </svg>
      );
    case "extracting":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
          <path d="M12 3v3" />
          <path d="M12 18v3" />
          <path d="M3 12h3" />
          <path d="M18 12h3" />
          <path d="M5.6 5.6l2.1 2.1" />
          <path d="M16.3 16.3l2.1 2.1" />
          <path d="M5.6 18.4l2.1-2.1" />
          <path d="M16.3 7.7l2.1-2.1" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case "done":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 3 3 5-6" />
        </svg>
      );
    case "error":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
          <path d="M12 3 2 21h20L12 3z" />
          <path d="M12 10v5" />
          <path d="M12 18h.01" />
        </svg>
      );
    case "idle":
    case "dragover":
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
          <path d="M12 16V5" />
          <path d="m7 10 5-5 5 5" />
          <path d="M5 19h14" />
        </svg>
      );
  }
}

function primaryLabel(status: Status, filename: string) {
  switch (status) {
    case "dragover":
      return "Release to upload";
    case "uploading":
      return filename ? `Uploading…` : "Uploading…";
    case "extracting":
      return "Extracting data…";
    case "done":
      return "Document processed";
    case "error":
      return "Document upload failed";
    case "idle":
    default:
      return "Drop your document here";
  }
}

function secondaryLabel(status: Status, error: string) {
  switch (status) {
    case "dragover":
      return "We'll handle the rest";
    case "uploading":
      return "Securely transferring to storage…";
    case "extracting":
      return "Reading invoice details with AI…";
    case "done":
      return "Form fields below have been pre-filled — review and save";
    case "error":
      return error || "Try again or pick a different file";
    case "idle":
    default:
      return "or click to browse — PDF, PNG, JPG, JPEG. You can add multiple files.";
  }
}

async function safeJson(res: Response): Promise<{
  message?: string;
  error?: string;
}> {
  try {
    return (await res.json()) as { message?: string; error?: string };
  } catch {
    return {};
  }
}
