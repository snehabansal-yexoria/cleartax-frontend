import { NextResponse } from "next/server";
import { fetchCoreLedger } from "@/src/lib/coreApi";
import {
  getRequestToken,
  parseLedgerQuery,
  renderUpstreamError,
} from "@/src/lib/coreApiProxy";

/**
 * GET /api/entities/{id}/reconciliation-sessions/{sessionId}/ledger
 *
 * The account ledger for one reconciled bank statement. Upstream returns a 409
 * (`session_not_completed`) while the reconciliation is still open — that is
 * forwarded verbatim by renderUpstreamError so the page can say why rather than
 * showing a generic failure.
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

  try {
    const ledger = await fetchCoreLedger(
      token,
      id,
      sessionId,
      parseLedgerQuery(req),
    );
    return NextResponse.json(ledger);
  } catch (error) {
    return renderUpstreamError(
      `GET /api/entities/${id}/reconciliation-sessions/${sessionId}/ledger`,
      error,
    );
  }
}
