import { NextResponse } from "next/server";
import { CoreApiError } from "./coreApi";

export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value;
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
