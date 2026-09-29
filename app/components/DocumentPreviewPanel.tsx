"use client";

import { useEffect, useRef, useState } from "react";

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

function getFileExt(filename: string): string {
  return (filename.match(/\.[^.]+$/)?.[0] ?? "").toLowerCase();
}

function isPdfFile(filename: string) {
  return getFileExt(filename) === ".pdf";
}

function isImageFile(filename: string) {
  return IMAGE_EXTS.includes(getFileExt(filename));
}

type PreviewState =
  | { kind: "loading" }
  | { kind: "ready"; url: string }
  | { kind: "error"; message: string };

export function DocumentPreviewPanel({
  documentId,
  filename,
  token,
  onReset,
}: {
  documentId: string;
  filename: string;
  token: string;
  onReset: () => void;
}) {
  const [state, setState] = useState<PreviewState>({ kind: "loading" });
  const urlRef = useRef<string | null>(null);

  async function fetchSignedUrl() {
    setState({ kind: "loading" });
    try {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/download`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || `Failed to load document (${res.status})`);
      }
      const data = (await res.json()) as { download_url: string };
      urlRef.current = data.download_url;
      setState({ kind: "ready", url: data.download_url });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to load document preview.",
      });
    }
  }

  useEffect(() => {
    fetchSignedUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  function openInNewTab() {
    const url = state.kind === "ready" ? state.url : urlRef.current;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  const isPdf = isPdfFile(filename);
  const isImage = isImageFile(filename);

  return (
    <div className="doc-preview-panel">
      {/* ── Header bar ── */}
      <div className="doc-preview-header">
        <div className="doc-preview-header-file">
          <span className="doc-preview-file-icon" aria-hidden="true">
            {isPdf ? (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M9 13h6" />
                <path d="M9 17h6" />
                <path d="M9 9h1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            )}
          </span>
          <span className="doc-preview-filename" title={filename}>
            {filename}
          </span>
        </div>

        <div className="doc-preview-header-actions">
          {state.kind === "ready" && (
            <button
              type="button"
              className="doc-preview-action-btn"
              onClick={openInNewTab}
              aria-label="Open document in new tab"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <path d="M15 3h6v6" />
                <path d="m10 14 11-11" />
              </svg>
              Open
            </button>
          )}
          <button
            type="button"
            className="doc-preview-reset-btn"
            onClick={onReset}
            aria-label="Upload a different document"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 16V5" />
              <path d="m7 10 5-5 5 5" />
              <path d="M5 19h14" />
            </svg>
            Upload another
          </button>
        </div>
      </div>

      {/* ── Preview body ── */}
      <div className="doc-preview-body">
        {state.kind === "loading" && <DocumentPreviewSkeleton />}

        {state.kind === "error" && (
          <div className="doc-preview-error">
            <span className="doc-preview-error-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 3 2 21h20L12 3z" />
                <path d="M12 10v5" />
                <path d="M12 18h.01" />
              </svg>
            </span>
            <strong>Preview unavailable</strong>
            <p>{state.message}</p>
            <div className="doc-preview-error-actions">
              <button
                type="button"
                className="doc-preview-action-btn"
                onClick={() => fetchSignedUrl()}
              >
                Retry
              </button>
              {urlRef.current && (
                <button
                  type="button"
                  className="doc-preview-action-btn"
                  onClick={openInNewTab}
                >
                  Open in new tab
                </button>
              )}
            </div>
          </div>
        )}

        {state.kind === "ready" && isPdf && (
          <>
            {/* Desktop: inline PDF iframe */}
            <iframe
              className="doc-preview-iframe"
              src={`${state.url}#toolbar=1&navpanes=0&view=FitH`}
              title={`Preview: ${filename}`}
              aria-label={`Document preview for ${filename}`}
            />
            {/* Mobile fallback — shown via CSS only on small screens */}
            <div className="doc-preview-mobile-fallback">
              <span className="doc-preview-file-icon doc-preview-file-icon--large" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                  <path d="M9 13h6" />
                  <path d="M9 17h6" />
                  <path d="M9 9h1" />
                </svg>
              </span>
              <strong>{filename}</strong>
              <p>PDF preview is not available on small screens.</p>
              <button
                type="button"
                className="doc-preview-reset-btn"
                onClick={openInNewTab}
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <path d="M15 3h6v6" />
                  <path d="m10 14 11-11" />
                </svg>
                Open PDF
              </button>
            </div>
          </>
        )}

        {state.kind === "ready" && isImage && (
          <div className="doc-preview-image-wrap">
            <img
              src={state.url}
              alt={`Preview of ${filename}`}
              className="doc-preview-image"
            />
          </div>
        )}

        {state.kind === "ready" && !isPdf && !isImage && (
          <div className="doc-preview-error">
            <strong>Preview not supported for this file type.</strong>
            <div className="doc-preview-error-actions">
              <button
                type="button"
                className="doc-preview-action-btn"
                onClick={openInNewTab}
              >
                Open in new tab
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentPreviewSkeleton() {
  return (
    <div className="doc-preview-skeleton" aria-label="Loading document preview…" role="status">
      <div className="doc-preview-skeleton-shimmer" />
      <div className="doc-preview-skeleton-shimmer doc-preview-skeleton-shimmer--short" />
      <div className="doc-preview-skeleton-shimmer" />
      <div className="doc-preview-skeleton-shimmer doc-preview-skeleton-shimmer--mid" />
      <div className="doc-preview-skeleton-shimmer" />
      <div className="doc-preview-skeleton-shimmer doc-preview-skeleton-shimmer--short" />
    </div>
  );
}
