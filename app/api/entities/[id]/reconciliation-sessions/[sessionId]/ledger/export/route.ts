import { NextResponse } from "next/server";
import {
  fetchCoreLedgerExport,
  type CoreTransactionExportFormat,
} from "@/src/lib/coreApi";
import {
  getRequestToken,
  parseLedgerQuery,
  renderUpstreamError,
} from "@/src/lib/coreApiProxy";

function parseFormat(value: string | null): CoreTransactionExportFormat {
  const s = (value ?? "").trim().toLowerCase();
  if (s === "xlsx" || s === "excel") return "xlsx";
  if (s === "pdf") return "pdf";
  return "csv";
}

/**
 * GET …/ledger/export?format=csv|xlsx|pdf
 *
 * Exports the whole filter set, not the loaded page — the same date range,
 * category and type the ledger is showing, plus the opening/closing balance
 * bands and the unused-categories block. The upstream body is piped straight
 * through rather than buffered, mirroring /api/transactions/export.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
) {
  const token = getRequestToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id, sessionId } = await params;
  const format = parseFormat(new URL(req.url).searchParams.get("format"));
  const op = `GET /api/entities/${id}/reconciliation-sessions/${sessionId}/ledger/export`;

  try {
    const upstream = await fetchCoreLedgerExport(
      token,
      id,
      sessionId,
      format,
      parseLedgerQuery(req),
    );

    if (!upstream.ok) {
      // Over-cap exports come back as a structured 400 ("narrow the filters"),
      // and an open session as a 409 — both are shown verbatim, so forward them
      // rather than flattening to 502.
      const text = await upstream.text();
      console.error(`${op} upstream error`, upstream.status, text.slice(0, 500));
      return new NextResponse(text, {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const headers = new Headers();
    const disposition = upstream.headers.get("content-disposition");
    if (disposition) headers.set("Content-Disposition", disposition);
    headers.set(
      "Content-Type",
      upstream.headers.get("content-type") || "application/octet-stream",
    );
    headers.set("Cache-Control", "no-store");

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (error) {
    return renderUpstreamError(op, error);
  }
}
