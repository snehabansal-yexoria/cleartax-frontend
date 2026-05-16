import { NextResponse } from "next/server";
import { pool } from "@/src/lib/db";
import { verifyToken } from "@/src/lib/verifyToken";

const ENSURE_TABLE = `
  CREATE TABLE IF NOT EXISTS reconciliation_match (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_id UUID NOT NULL REFERENCES reconciliation(id) ON DELETE CASCADE,
    bank_tx_index     INTEGER NOT NULL,
    transaction_id    UUID REFERENCES transaction(id) ON DELETE RESTRICT,
    status            VARCHAR(20) NOT NULL DEFAULT 'confirmed',
    confirmed_by      VARCHAR(255) NOT NULL,
    confirmed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (reconciliation_id, bank_tx_index)
  );
  CREATE INDEX IF NOT EXISTS reconciliation_match_recon_idx ON reconciliation_match (reconciliation_id);
  CREATE INDEX IF NOT EXISTS reconciliation_match_tx_idx    ON reconciliation_match (transaction_id);
`;

type Params = { params: Promise<{ id: string; reconciliationId: string }> };

async function resolveAndAuthorise(req: Request, params: Params["params"]) {
  const { id: entityId, reconciliationId } = await params;

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { error: NextResponse.json({ error: "No token" }, { status: 401 }) };

  const payload = await verifyToken(token);
  if (!payload) return { error: NextResponse.json({ error: "Invalid token" }, { status: 401 }) };

  const userId = String(payload.sub ?? payload["cognito:username"] ?? "");

  // Verify the reconciliation belongs to the stated entity (prevents cross-entity injection)
  await pool.query(ENSURE_TABLE);
  const check = await pool.query(
    "SELECT id FROM reconciliation WHERE id = $1 AND entity_id = $2 LIMIT 1",
    [reconciliationId, entityId],
  );
  if (check.rowCount === 0) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  return { entityId, reconciliationId, userId };
}

export async function GET(req: Request, { params }: Params) {
  const ctx = await resolveAndAuthorise(req, params);
  if ("error" in ctx) return ctx.error;

  const rows = await pool.query(
    `SELECT id, reconciliation_id, bank_tx_index, transaction_id, status, confirmed_by, confirmed_at, created_at
     FROM reconciliation_match
     WHERE reconciliation_id = $1
     ORDER BY bank_tx_index ASC`,
    [ctx.reconciliationId],
  );

  return NextResponse.json(
    rows.rows.map((r) => ({
      id: r.id,
      reconciliationId: r.reconciliation_id,
      bankTxIndex: r.bank_tx_index,
      transactionId: r.transaction_id,
      status: r.status,
      confirmedBy: r.confirmed_by,
      confirmedAt: r.confirmed_at,
    })),
  );
}

export async function POST(req: Request, { params }: Params) {
  const ctx = await resolveAndAuthorise(req, params);
  if ("error" in ctx) return ctx.error;

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

  const row = await pool.query(
    `INSERT INTO reconciliation_match
       (reconciliation_id, bank_tx_index, transaction_id, status, confirmed_by, confirmed_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (reconciliation_id, bank_tx_index)
       DO UPDATE SET
         transaction_id = EXCLUDED.transaction_id,
         status         = EXCLUDED.status,
         confirmed_by   = EXCLUDED.confirmed_by,
         confirmed_at   = EXCLUDED.confirmed_at
     RETURNING id, reconciliation_id, bank_tx_index, transaction_id, status, confirmed_by, confirmed_at`,
    [ctx.reconciliationId, bankTxIndex, transactionId, status, ctx.userId],
  );

  const r = row.rows[0];
  return NextResponse.json({
    id: r.id,
    reconciliationId: r.reconciliation_id,
    bankTxIndex: r.bank_tx_index,
    transactionId: r.transaction_id,
    status: r.status,
    confirmedBy: r.confirmed_by,
    confirmedAt: r.confirmed_at,
  });
}

export async function DELETE(req: Request, { params }: Params) {
  const ctx = await resolveAndAuthorise(req, params);
  if ("error" in ctx) return ctx.error;

  const { searchParams } = new URL(req.url);
  const bankTxIndex = Number(searchParams.get("bankTxIndex"));
  if (Number.isNaN(bankTxIndex)) {
    return NextResponse.json({ error: "bankTxIndex query param required" }, { status: 400 });
  }

  await pool.query(
    "DELETE FROM reconciliation_match WHERE reconciliation_id = $1 AND bank_tx_index = $2",
    [ctx.reconciliationId, bankTxIndex],
  );

  return NextResponse.json({ ok: true });
}
