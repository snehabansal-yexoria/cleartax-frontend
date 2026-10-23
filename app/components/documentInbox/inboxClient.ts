import type { CoreInboxDocument, CoreInboxPage, CoreInboxStatus } from "@/src/lib/coreApi";
import { getIdToken } from "@/src/lib/authToken";

// Browser-side calls for the emailed-documents inbox. Every route is org-scoped,
// so the caller's org id is looked up once per page load and reused.

let orgIdPromise: Promise<string> | null = null;

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export function getOrgId(): Promise<string> {
  if (!orgIdPromise) {
    orgIdPromise = (async () => {
      const res = await fetch("/api/users/me/organization", {
        headers: await authHeaders(),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as {
        organization?: { id?: string } | null;
      };
      const id = body.organization?.id;
      if (!res.ok || !id) throw new Error("Could not resolve your organisation");
      return id;
    })().catch((error) => {
      orgIdPromise = null; // let the next call retry
      throw error;
    });
  }
  return orgIdPromise;
}

async function readError(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  return new Error(body.message || body.error || `Request failed (${res.status})`);
}

async function inboxUrl(suffix = "") {
  return `/api/orgs/${encodeURIComponent(await getOrgId())}/document-inbox${suffix}`;
}

export async function fetchInbox(params: {
  status?: CoreInboxStatus | "all";
  clientId?: string;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
}): Promise<CoreInboxPage> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.clientId) query.set("client_id", params.clientId);
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.limit) query.set("limit", String(params.limit));
  const res = await fetch(await inboxUrl(`?${query.toString()}`), {
    headers: await authHeaders(),
    cache: "no-store",
    signal: params.signal,
  });
  if (!res.ok) throw await readError(res);
  return (await res.json()) as CoreInboxPage;
}

export async function fetchInboxDocument(docId: string): Promise<CoreInboxDocument> {
  const res = await fetch(await inboxUrl(`/${encodeURIComponent(docId)}`), {
    headers: await authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw await readError(res);
  return (await res.json()) as CoreInboxDocument;
}

export async function actionInboxDocument(
  docId: string,
  action: "reject" | "discard",
  text: string,
): Promise<CoreInboxDocument> {
  const res = await fetch(await inboxUrl(`/${encodeURIComponent(docId)}/${action}`), {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify(action === "reject" ? { note: text } : { reason: text }),
  });
  if (!res.ok) throw await readError(res);
  return (await res.json()) as CoreInboxDocument;
}

export async function fetchInboxAddress(): Promise<{ address: string; enabled: boolean }> {
  const res = await fetch(await inboxUrl("/address"), {
    headers: await authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw await readError(res);
  return (await res.json()) as { address: string; enabled: boolean };
}

export const ACCOUNTANT_INBOX_PATH = "/dashboard/accountant/inbox";

// Filing reuses the accountant's Add Transaction screen: it loads the emailed
// document, locks the client, and on save creates + approves the transaction.
export function filingHref(docId: string, returnTo: string = ACCOUNTANT_INBOX_PATH) {
  const query = new URLSearchParams({ inboxDocumentId: docId, returnTo });
  return `/dashboard/accountant/transactions/new?${query.toString()}`;
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
