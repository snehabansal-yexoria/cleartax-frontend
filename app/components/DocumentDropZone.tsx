"use client";

import { useRef, useState } from "react";

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
}: {
  token: string | null;
  onExtracted: (data: ExtractedDocumentData, documentId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);

  const busy = status === "uploading" || status === "extracting";

  function pickFile() {
    if (busy) return;
    inputRef.current?.click();
  }

  async function handleFile(file: File) {
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

    setFilename(file.name);
    setError("");
    setProgress(0);

    try {
      setStatus("uploading");
      setProgress(8);
      const presignRes = await fetch(
        `/api/documents/presign?filename=${encodeURIComponent(file.name)}`,
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
      setProgress(20);

      const putRes = await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`Upload to S3 failed (${putRes.status})`);
      }

      setStatus("extracting");
      setProgress(62);
      const progressTimer = window.setInterval(() => {
        setProgress((current) => {
          if (current >= 94) return current;
          return current + (current < 80 ? 4 : 1);
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

      onExtracted(result.data ?? {}, document_id);
      setProgress(100);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Document processing failed");
      setStatus("error");
      setProgress(0);
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (busy) return;
    setStatus((s) => (s === "dragover" ? "idle" : s));
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
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
        ) : (
          <span>{iconForStatus(status)}</span>
        )}
        <strong>{primaryLabel(status, filename)}</strong>
        <small>{secondaryLabel(status, error)}</small>
        {filename && (status === "uploading" || status === "extracting" || status === "done") ? (
          <span className="transaction-document-drop__caption">{filename}</span>
        ) : null}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        style={{ display: "none" }}
        onChange={onChange}
      />
    </div>
  );
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
      return "or click to browse — PDF, PNG, JPG, JPEG";
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
