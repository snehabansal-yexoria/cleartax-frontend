"use client";

import { useEffect, useState, useRef } from "react";

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
  | { kind: "client"; clientId: string }
  | { kind: "owner" };
  token: string;
};

type UploadingFile = {
  id: string;
  name: string;
  progress: number;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="2" />
      <line x1="8" y1="17" x2="14" y2="17" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
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

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
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
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const entityId = context.kind === "entity" ? context.entityId : undefined;
  const propertyId = context.kind === "property" ? context.propertyId : undefined;
  const clientId = context.kind === "client" ? context.clientId : undefined;
  const contextKind = context.kind;

  const fetchDocuments = () => {
    if (!token) return;
    const qs =
      contextKind === "entity" && entityId
        ? `entity_id=${encodeURIComponent(entityId)}`
        : contextKind === "property" && propertyId
          ? `property_id=${encodeURIComponent(propertyId)}`
          : contextKind === "client" && clientId
            ? `client_id=${encodeURIComponent(clientId)}`
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
        setDocuments(data.items ?? []);
      })
      .catch(() => {
        setError("Failed to load documents.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDocuments();
  }, [token, contextKind, entityId, propertyId, clientId]);

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

  async function handlePreview(id: string) {
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(id)}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("preview_failed");
      const data = (await res.json()) as { download_url: string };
      window.open(data.download_url, "_blank", "noopener,noreferrer");
    } catch {
      // silently fail
    }
  }

  function triggerFileUpload() {
    fileInputRef.current?.click();
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    // Reset input so user can pick the same file again if desired
    e.target.value = "";

    for (const file of files) {
      const tempId = Math.random().toString(36).substring(7);
      setUploadingFiles((prev) => [...prev, { id: tempId, name: file.name, progress: 0 }]);

      try {
        const presignParams = new URLSearchParams({
          filename: file.name,
          document_type: "direct",
        });
        if (entityId) presignParams.set("entity_id", entityId);
        if (propertyId) presignParams.set("property_id", propertyId);

        const presignRes = await fetch(`/api/documents/presign?${presignParams.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!presignRes.ok) {
          throw new Error("Presign failed");
        }

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

        // Small delay to simulate completion settle, then remove the loader and refetch
        setTimeout(() => {
          setUploadingFiles((prev) => prev.filter((f) => f.id !== tempId));
          fetchDocuments();
        }, 600);

      } catch (err) {
        console.error("Direct upload failed:", err);
        alert(`Failed to upload ${file.name}. Please try again.`);
        setUploadingFiles((prev) => prev.filter((f) => f.id !== tempId));
      }
    }
  }

  const title =
    context.kind === "property"
      ? "Property Documents"
      : context.kind === "entity"
        ? "Entity Documents"
        : context.kind === "client"
          ? "Client Document Vault"
          : "Documents";

  return (
    <div className="premium-docs-container">
      <div className="premium-docs-header">
        <h2 className="premium-docs-title">{title}</h2>
        <button
          type="button"
          onClick={triggerFileUpload}
          className="premium-docs-upload-btn space-x-2"
        >
          <UploadIcon />
          <span>Upload Document</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleUploadFile}
        accept=".pdf,.png,.jpg,.jpeg"
        style={{ display: "none" }}
      />

      {loading && documents.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[1, 2, 3].map((n) => (
            <div key={n} className="premium-doc-card" style={{ opacity: 0.6 }}>
              <div className="premium-doc-left">
                <div className="premium-doc-icon-wrapper" style={{ animation: "pulse 1.5s infinite" }} />
                <div className="premium-doc-details">
                  <div style={{ width: 180, height: 16, backgroundColor: "#eaecf0", borderRadius: 4, marginBottom: 8, animation: "pulse 1.5s infinite" }} />
                  <div style={{ width: 260, height: 12, backgroundColor: "#f2f4f7", borderRadius: 4, animation: "pulse 1.5s infinite" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="client-detail-empty" style={{ borderColor: "#fda29b", backgroundColor: "#fef3f2" }}>
          <svg viewBox="0 0 24 24" width="32" height="32" stroke="#f04438" strokeWidth="1.5" fill="none" style={{ marginBottom: 8 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p style={{ color: "#b42318", fontWeight: 600 }}>{error}</p>
          <button type="button" onClick={fetchDocuments} className="premium-docs-upload-btn" style={{ marginTop: 12, backgroundColor: "#d92d20" }}>
            Retry Loading
          </button>
        </div>
      ) : documents.length === 0 && uploadingFiles.length === 0 ? (
        <div className="client-detail-empty">
          <svg
            viewBox="0 0 24 24"
            width="48"
            height="48"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ color: "#d0d5dd", marginBottom: 12 }}
          >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <p style={{ fontSize: 16, fontWeight: 600, color: "#344054" }}>No documents uploaded yet</p>
          <p style={{ fontSize: 14, color: "#667085", marginTop: 4 }}>No documents have been uploaded for this client.</p>
        </div>
      ) : (
        <ul className="premium-docs-list">
          {/* Active direct uploads */}
          {uploadingFiles.map((upFile) => (
            <li key={upFile.id} className="premium-doc-card is-uploading">
              <div className="premium-doc-left">
                <div className="premium-doc-icon-wrapper">
                  <SpinnerIcon />
                </div>
                <div className="premium-doc-details">
                  <strong className="premium-doc-name">{upFile.name}</strong>
                  <div className="premium-doc-meta">
                    <span>Uploading…</span>
                    <span className="premium-doc-meta-separator">•</span>
                    <span>{upFile.progress}% complete</span>
                  </div>
                  <div className="premium-doc-progress-container">
                    <div className="premium-doc-progress-bar" style={{ width: `${upFile.progress}%` }} />
                  </div>
                </div>
              </div>
            </li>
          ))}

          {/* Uploaded documents list */}
          {documents.map((doc, index) => (
            <li key={`${doc.id}-${index}`} className="premium-doc-card">
              <div className="premium-doc-left">
                <div className="premium-doc-icon-wrapper">
                  <FileIcon />
                </div>
                <div className="premium-doc-details">
                  <strong className="premium-doc-name">
                    {doc.original_file_name || doc.file_name}
                  </strong>
                  <div className="premium-doc-meta">
                    <span>
                      {doc.document_type ? titleCase(doc.document_type) : titleCase(doc.mime_type)}
                    </span>
                    <span className="premium-doc-meta-separator">•</span>
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span className="premium-doc-meta-separator">•</span>
                    <span>Uploaded {formatDate(doc.created_at)}</span>
                  </div>
                </div>
              </div>

              <div className="premium-doc-actions">
                <button
                  type="button"
                  className="premium-doc-action-btn"
                  aria-label={`Preview ${doc.original_file_name || doc.file_name}`}
                  onClick={() => handlePreview(doc.id)}
                  title="Preview Document"
                >
                  <EyeIcon />
                </button>
                <button
                  type="button"
                  className="premium-doc-action-btn"
                  aria-label={`Download ${doc.original_file_name || doc.file_name}`}
                  disabled={downloading === doc.id}
                  onClick={() => handleDownload(doc.id, doc.original_file_name || doc.file_name)}
                  title="Download Document"
                >
                  {downloading === doc.id ? <SpinnerIcon /> : <DownloadIcon />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
