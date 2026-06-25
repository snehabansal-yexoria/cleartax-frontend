import { NextResponse } from "next/server";
import { CoreApiError } from "./coreApi";

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
