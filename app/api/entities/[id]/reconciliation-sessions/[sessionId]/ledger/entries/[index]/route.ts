import { NextResponse } from "next/server";
import { patchCoreLedgerEntryName } from "@/src/lib/coreApi";
import { getRequestToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

/**
 * PATCH /api/entities/{id}/reconciliation-sessions/{sessionId}/ledger/entries/{index}
 *
 * Renames one statement line. Name is the ledger's only editable column, and it
 * is stored against the statement line rather than the matched transaction —
 * the transaction's own description is what the read-only Description column
 * shows.
 */
export async function PATCH(
  req: Request,
  {
    params,
  }: { params: Promise<{ id: string; sessionId: string; index: string }> },
) {
  const token = getRequestToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id, sessionId, index } = await params;
  const bankTxIndex = Number.parseInt(index, 10);
  if (!Number.isFinite(bankTxIndex) || bankTxIndex < 0) {
    return NextResponse.json(
      { code: "bad_request", message: "invalid statement line index" },
      { status: 400 },
    );
  }

  let body: { reconciliation_id?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: "bad_request", message: "invalid json body" },
      { status: 400 },
    );
  }

  const reconciliationId = String(body.reconciliation_id ?? "").trim();
  if (!reconciliationId) {
    return NextResponse.json(
      { code: "bad_request", message: "reconciliation_id is required" },
      { status: 400 },
    );
  }
  // An empty string is meaningful: it clears the override and lets the row fall
  // back to the payee the extractor inferred.
  const name = typeof body.name === "string" ? body.name : "";

  try {
    const updated = await patchCoreLedgerEntryName(
      token,
      id,
      sessionId,
      bankTxIndex,
      { reconciliationId, name },
    );
    return NextResponse.json(updated);
  } catch (error) {
    return renderUpstreamError(
      `PATCH /api/entities/${id}/reconciliation-sessions/${sessionId}/ledger/entries/${index}`,
      error,
      { reconciliationId, name },
    );
  }
}
