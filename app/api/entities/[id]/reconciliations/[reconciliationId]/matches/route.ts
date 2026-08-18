import { NextResponse } from "next/server";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";
import {
  listReconciliationMatches,
  createReconciliationMatch,
  deleteReconciliationMatch,
} from "@/src/lib/coreApi";

type Params = { params: Promise<{ id: string; reconciliationId: string }> };

export async function GET(req: Request, { params }: Params) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  const { id: entityId, reconciliationId } = await params;

  try {
    const matches = await listReconciliationMatches(token, entityId, reconciliationId);
    return NextResponse.json(matches);
  } catch (error) {
    return renderUpstreamError(
      `GET /api/entities/${entityId}/reconciliations/${reconciliationId}/matches`,
      error,
    );
  }
}

export async function POST(req: Request, { params }: Params) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  const { id: entityId, reconciliationId } = await params;

  let body: { bankTxIndex?: unknown; transactionId?: unknown; status?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bankTxIndex = typeof body.bankTxIndex === "number" ? body.bankTxIndex : null;
  const transactionId = typeof body.transactionId === "string" ? body.transactionId : null;
  const status = body.status === "excluded" ? "excluded" : "confirmed";

  if (bankTxIndex === null || bankTxIndex < 0) {
    return NextResponse.json({ error: "bankTxIndex is required" }, { status: 400 });
  }

  try {
    const match = await createReconciliationMatch(token, entityId, reconciliationId, {
      bankTxIndex,
      transactionId,
      status,
    });
    return NextResponse.json(match);
  } catch (error) {
    return renderUpstreamError(
      `POST /api/entities/${entityId}/reconciliations/${reconciliationId}/matches`,
      error,
    );
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  const { id: entityId, reconciliationId } = await params;

  const { searchParams } = new URL(req.url);
  const bankTxIndex = Number(searchParams.get("bankTxIndex"));
  if (Number.isNaN(bankTxIndex)) {
    return NextResponse.json({ error: "bankTxIndex query param required" }, { status: 400 });
  }

  try {
    await deleteReconciliationMatch(token, entityId, reconciliationId, bankTxIndex);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return renderUpstreamError(
      `DELETE /api/entities/${entityId}/reconciliations/${reconciliationId}/matches`,
      error,
    );
  }
}
