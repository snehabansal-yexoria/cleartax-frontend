import { NextResponse } from "next/server";
import { patchCoreReconciliationAccount } from "@/src/lib/coreApi";
import { getRequestToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

/**
 * PATCH /api/entities/{id}/reconciliations/{reconciliationId}/account
 *
 * Sets the account name and opening balance a statement did not carry. Every
 * CSV upload lands here: the parser stores no account metadata at all, so
 * without this the ledger has nothing to anchor its running balance to.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; reconciliationId: string }> },
) {
  const token = getRequestToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id, reconciliationId } = await params;

  let body: {
    bank?: unknown;
    account_number?: unknown;
    opening_balance?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: "bad_request", message: "invalid json body" },
      { status: 400 },
    );
  }

  const patch: {
    bank?: string;
    accountNumber?: string;
    openingBalance?: number;
  } = {};
  if (typeof body.bank === "string") patch.bank = body.bank;
  if (typeof body.account_number === "string") {
    patch.accountNumber = body.account_number;
  }
  if (body.opening_balance !== undefined && body.opening_balance !== null) {
    const n = Number(body.opening_balance);
    if (!Number.isFinite(n)) {
      return NextResponse.json(
        { code: "bad_request", message: "opening_balance must be a number" },
        { status: 400 },
      );
    }
    patch.openingBalance = n;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      {
        code: "bad_request",
        message: "provide at least one of bank, account_number, opening_balance",
      },
      { status: 400 },
    );
  }

  try {
    const updated = await patchCoreReconciliationAccount(
      token,
      id,
      reconciliationId,
      patch,
    );
    return NextResponse.json(updated);
  } catch (error) {
    return renderUpstreamError(
      `PATCH /api/entities/${id}/reconciliations/${reconciliationId}/account`,
      error,
      patch,
    );
  }
}
