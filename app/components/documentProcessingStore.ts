"use client";

import type { ExtractedDocumentData } from "@/app/components/DocumentDropZone";

export type DocumentProcessingStatus =
  | "queued"
  | "uploading"
  // In S3, extraction deliberately deferred — the client chose "Submit to
  // accountant", so Bedrock runs when the accountant opens the transaction.
  | "uploaded"
  | "extracting"
  | "done"
  | "error";

export type DocumentProcessingJob = {
  id: string;
  documentId?: string;
  filename: string;
  status: DocumentProcessingStatus;
  progress: number;
  href: string;
  createdAt: number;
  updatedAt: number;
  error?: string;
  data?: ExtractedDocumentData;
  scope?: DocumentProcessingScope;
};

export const DOCUMENT_PROCESSING_STORAGE_KEY = "cleartax_document_processing_jobs";
export const DOCUMENT_PROCESSING_EVENT = "cleartax:document-processing";

const JOB_TTL_MS = 24 * 60 * 60 * 1000;

export type DocumentProcessingScope = {
  clientId?: string;
  entityId?: string;
  propertyIds?: string[];
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function readDocumentProcessingJobs(): DocumentProcessingJob[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(DOCUMENT_PROCESSING_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DocumentProcessingJob[];
    const cutoff = Date.now() - JOB_TTL_MS;
    return parsed
      .filter((job) => job.createdAt > cutoff)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function writeDocumentProcessingJobs(jobs: DocumentProcessingJob[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(
    DOCUMENT_PROCESSING_STORAGE_KEY,
    JSON.stringify(jobs),
  );
  window.dispatchEvent(new CustomEvent(DOCUMENT_PROCESSING_EVENT));
}

export function upsertDocumentProcessingJob(
  patch: Partial<DocumentProcessingJob> & Pick<DocumentProcessingJob, "id" | "filename">,
) {
  const now = Date.now();
  const jobs = readDocumentProcessingJobs();
  const existingIndex = jobs.findIndex((job) => job.id === patch.id);
  const existing = existingIndex >= 0 ? jobs[existingIndex] : null;
  const next: DocumentProcessingJob = {
    id: patch.id,
    filename: patch.filename,
    status: patch.status ?? existing?.status ?? "queued",
    progress: patch.progress ?? existing?.progress ?? 0,
    href: patch.href ?? existing?.href ?? "/dashboard/accountant/transactions/new",
    createdAt: existing?.createdAt ?? patch.createdAt ?? now,
    updatedAt: now,
    documentId: patch.documentId ?? existing?.documentId,
    data: patch.data ?? existing?.data,
    error: patch.error,
    scope: patch.scope ?? existing?.scope,
  };

  if (existingIndex >= 0) {
    jobs[existingIndex] = next;
  } else {
    jobs.unshift(next);
  }
  writeDocumentProcessingJobs(jobs);
  return next;
}

export function findDocumentProcessingJob(id: string) {
  return readDocumentProcessingJobs().find((job) => job.id === id) ?? null;
}

export function dismissDocumentProcessingJob(id: string) {
  writeDocumentProcessingJobs(
    readDocumentProcessingJobs().filter((job) => job.id !== id),
  );
}
