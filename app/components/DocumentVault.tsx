"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  DOCUMENT_PROCESSING_EVENT,
  readDocumentProcessingJobs,
  type DocumentProcessingJob,
  type DocumentProcessingScope,
} from "@/app/components/documentProcessingStore";

type DocumentVaultProps = {
  scope: DocumentProcessingScope;
  title?: string;
};

function formatDate(value: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function scopeMatches(job: DocumentProcessingJob, scope: DocumentProcessingScope) {
  if (scope.propertyIds?.length) {
    return scope.propertyIds.some((id) => job.scope?.propertyIds?.includes(id));
  }
  if (scope.entityId) {
    return job.scope?.entityId === scope.entityId;
  }
  if (scope.clientId) {
    return job.scope?.clientId === scope.clientId;
  }
  return true;
}

function documentDescription(job: DocumentProcessingJob) {
  const data = job.data;
  if (!data) return "Uploaded document";
  return data.description || data.title || data.vendor || data.payer || "Uploaded document";
}

function documentAmount(job: DocumentProcessingJob) {
  if (typeof job.data?.amount !== "number" || !Number.isFinite(job.data.amount)) {
    return "-";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: job.data.currency || "USD",
  }).format(job.data.amount);
}

function statusLabel(job: DocumentProcessingJob) {
  if (job.status === "done") return "Ready";
  if (job.status === "extracting") return "Extracting";
  if (job.status === "uploading") return "Uploading";
  if (job.status === "queued") return "Queued";
  return "Failed";
}

export function DocumentVault({ scope, title = "Document Vault" }: DocumentVaultProps) {
  const [jobs, setJobs] = useState<DocumentProcessingJob[]>([]);

  useEffect(() => {
    function syncJobs() {
      setJobs(readDocumentProcessingJobs());
    }

    syncJobs();
    window.addEventListener(DOCUMENT_PROCESSING_EVENT, syncJobs);
    window.addEventListener("storage", syncJobs);
    return () => {
      window.removeEventListener(DOCUMENT_PROCESSING_EVENT, syncJobs);
      window.removeEventListener("storage", syncJobs);
    };
  }, []);

  const documents = useMemo(
    () => jobs.filter((job) => scopeMatches(job, scope)),
    [jobs, scope],
  );

  return (
    <div className="document-vault">
      <div className="document-vault-head">
        <div>
          <h2>{title}</h2>
          <p>Documents uploaded for this level of the portfolio.</p>
        </div>
        <span>{documents.length} document{documents.length === 1 ? "" : "s"}</span>
      </div>

      {documents.length === 0 ? (
        <div className="document-vault-empty">
          <strong>No documents yet</strong>
          <p>Upload a transaction document from this client, entity, or property flow and it will appear here.</p>
        </div>
      ) : (
        <ul className="document-vault-list">
          {documents.map((job) => (
            <li key={job.id} className="document-vault-row">
              <div className="document-vault-file">
                <span aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                    <path d="M14 2v5h5" />
                    <path d="M9 13h6" />
                    <path d="M9 17h4" />
                  </svg>
                </span>
                <div>
                  <strong>{job.filename}</strong>
                  <p>{documentDescription(job)}</p>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Status</dt>
                  <dd className={`document-vault-status is-${job.status}`}>
                    {statusLabel(job)}
                  </dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>{documentAmount(job)}</dd>
                </div>
                <div>
                  <dt>Added</dt>
                  <dd>{formatDate(job.createdAt)}</dd>
                </div>
              </dl>
              <Link href={job.href} className="document-vault-open">
                Review
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
