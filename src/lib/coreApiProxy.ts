import { NextResponse } from "next/server";
import {
  CoreApiError,
  toCoreReviewStatusParam,
  type CoreTransactionListQuery,
  type CoreTransactionType,
} from "./coreApi";
import { TRANSACTION_TYPES } from "./transactionTypes";

export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value;
}

// Resolve the caller's JWT from the request, preferring the Authorization
// header but falling back to the `idToken` cookie set at login. AWS Amplify's
// CloudFront strips the Authorization header from SSR/API requests by default,
// so same-origin calls arrive without it there; the cookie is forwarded, which
// keeps bearer-token auth working. (Vercel forwards the header, so it wins.)
export function getRequestToken(req: Request): string | null {
  const fromHeader = getBearerToken(req);
  if (fromHeader) return fromHeader;

  const cookie = req.headers.get("cookie");
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)idToken=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

export function summarizeBody(body: unknown): string | undefined {
  if (body === undefined) return undefined;
  try {
    const json = JSON.stringify(body);
    if (!json) return "<empty>";
    return json.length > 600 ? `${json.slice(0, 600)}…` : json;
  } catch {
    return "<unserializable>";
  }
}

/**
 * Render an upstream Core API error as a Next response. CoreApiError instances
 * are forwarded with the upstream status + structured body so the UI can show
 * the real error code/message; everything else falls through to a 502 with the
 * raw error text. Logs everything via console.error with structured context for
 * server-side debugging.
 */
export function renderUpstreamError(
  op: string,
  error: unknown,
  requestBody?: unknown,
): NextResponse {
  const requestBodySummary = summarizeBody(requestBody);

  if (error instanceof CoreApiError) {
    console.error(
      `${op} upstream error`,
      JSON.stringify(
        {
          status: error.status,
          statusText: error.statusText,
          code: error.code,
          upstreamMessage: error.upstreamMessage,
          bodyExcerpt: error.bodyExcerpt,
          method: error.method,
          path: error.path,
          requestBody: requestBodySummary,
        },
        null,
        2,
      ),
    );
    return NextResponse.json(
      {
        code: error.code || "upstream_error",
        message:
          error.upstreamMessage ||
          `Upstream returned ${error.status} ${error.statusText}`,
        upstreamStatus: error.status,
      },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`${op} unexpected error`, {
    message,
    requestBody: requestBodySummary,
  });
  return NextResponse.json({ error: message }, { status: 502 });
}

/**
 * Parse the transactions grid's query string into a typed CoreTransactionListQuery.
 *
 * Every parameter is read by name and validated rather than forwarding the raw
 * query string: the sort key reaches an ORDER BY clause upstream, and a blind
 * passthrough would also let a caller smuggle in filters the BFF has not
 * accounted for. The Go API whitelists these again — this is the first gate,
 * not the only one.
 */
export function parseTransactionListQuery(req: Request): CoreTransactionListQuery {
  const sp = new URL(req.url).searchParams;
  const str = (key: string) => {
    const value = sp.get(key)?.trim();
    return value ? value : undefined;
  };
  const int = (key: string) => {
    const raw = sp.get(key);
    if (raw === null || raw.trim() === "") return undefined;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  // Only ISO dates reach the API; anything else is dropped so a typo cannot
  // turn into an upstream 400 on every keystroke.
  const isoDate = (key: string) => {
    const value = str(key);
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
  };

  const dir = sp.get("dir")?.trim().toLowerCase();
  const type = sp.get("type")?.trim().toLowerCase();
  const bucket = sp.get("review_bucket")?.trim().toLowerCase();
  const grain = sp.get("grain")?.trim().toLowerCase();

  return {
    search: str("search"),
    from: isoDate("from"),
    to: isoDate("to"),
    reviewStatus: toCoreReviewStatusParam(sp.get("review_status")),
    reviewBucket:
      bucket === "queue" || bucket === "ledger" ? bucket : undefined,
    clientId: str("client_id"),
    entityId: str("entity_id"),
    propertyId: str("property_id"),
    // Checked against the full type list rather than a hardcoded
    // revenue/expense pair. That pair predated migration 0032, so filtering by
    // "personal" or "cost_base" was dropped here and came back as an unfiltered
    // list — which is exactly what the personal view asks for.
    type: TRANSACTION_TYPES.includes(type as CoreTransactionType)
      ? (type as CoreTransactionType)
      : undefined,
    categoryId: str("category_id"),
    // Which level of the parent/child tree to read. Omitted means the backend's
    // default, "top" — one row per bill.
    grain: grain === "top" || grain === "leaf" ? grain : undefined,
    sort: str("sort"),
    dir: dir === "asc" || dir === "desc" ? dir : undefined,
    limit: int("limit"),
    offset: int("offset"),
  };
}
