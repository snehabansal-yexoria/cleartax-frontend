"use client";

import { useEffect, useState } from "react";

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

export type DocumentsListViewProps = {
  context:
    | { kind: "entity"; entityId: string }
    | { kind: "property"; propertyId: string }
    | { kind: "owner" };
  token: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatFileSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sourceLabel(source: string) {
  if (source === "reconciliation") return "Bank Statement";
  if (source === "transaction") return "Transaction";
  return "Uploaded";
}

function statusColor(status: string) {
  if (status === "completed") return "var(--color-success, #16a34a)";
  if (status === "failed") return "var(--color-danger, #dc2626)";
  return "var(--color-warning, #ca8a04)";
}

function titleCase(value: string) {
  if (!value) return "—";
  return value
    .split(/[_\s-]+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

function FileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, color: "#667085" }}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      style={{ animation: "spin 0.9s linear infinite" }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export default function DocumentsListView({ context, token }: DocumentsListViewProps) {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const entityId = context.kind === "entity" ? context.entityId : undefined;
  const propertyId = context.kind === "property" ? context.propertyId : undefined;
  const contextKind = context.kind;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const qs =
      contextKind === "entity" && entityId
        ? `entity_id=${encodeURIComponent(entityId)}`
        : contextKind === "property" && propertyId
          ? `property_id=${encodeURIComponent(propertyId)}`
          : "owner_id=me";

    setLoading(true);
    setError("");

    fetch(`/api/documents/list?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json() as Promise<{ items?: DocumentListItem[] }>;
      })
      .then((data) => {
        if (!cancelled) setDocuments(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load documents.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [token, contextKind, entityId, propertyId]);

  async function handleDownload(id: string, fileName: string) {
    setDownloading(id);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(id)}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("download_failed");
      const data = (await res.json()) as { download_url: string; file_name: string };
      const a = document.createElement("a");
      a.href = data.download_url;
      a.download = data.file_name || fileName;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      // silently fail — browser will show the error
    } finally {
      setDownloading(null);
    }
  }

  if (loading) {
    return (
      <div className="client-detail-empty">
        <p>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="client-detail-empty">
        <p>{error}</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="client-detail-empty">
        <svg
          viewBox="0 0 24 24"
          width="32"
          height="32"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ color: "#d0d5dd", marginBottom: 8 }}
        >
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <p>No documents yet.</p>
      </div>
    );
  }

  return (
    <ul className="entity-property-list">
      {documents.map((doc) => (
        <li key={doc.id} className="entity-property-row">
          <div className="entity-property-main">
            <FileIcon />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <strong style={{ wordBreak: "break-word" }}>
                {doc.original_file_name || doc.file_name}
              </strong>
              <span
                style={{
                  fontSize: 12,
                  color: "#667085",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                }}
              >
                {sourceLabel(doc.source)}
              </span>
            </div>
          </div>

          <dl>
            <div>
              <dt>Type</dt>
              <dd>{doc.document_type ? titleCase(doc.document_type) : titleCase(doc.mime_type)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <span
                  style={{
                    color: statusColor(doc.processing_status),
                    fontWeight: 600,
                    textTransform: "capitalize",
                    fontSize: 13,
                  }}
                >
                  {titleCase(doc.processing_status)}
                </span>
              </dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{formatFileSize(doc.file_size)}</dd>
            </div>
            <div>
              <dt>Uploaded</dt>
              <dd>{formatDate(doc.created_at)}</dd>
            </div>
          </dl>

          <button
            type="button"
            className="document-download-btn"
            aria-label={`Download ${doc.original_file_name || doc.file_name}`}
            disabled={downloading === doc.id}
            onClick={() => handleDownload(doc.id, doc.original_file_name || doc.file_name)}
          >
            {downloading === doc.id ? <SpinnerIcon /> : <DownloadIcon />}
          </button>
        </li>
      ))}
    </ul>
  );
}
