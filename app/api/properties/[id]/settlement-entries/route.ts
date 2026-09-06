import { NextResponse } from "next/server";
import {
  createCoreSettlementEntry,
  listCoreSettlementEntries,
} from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Settlement funding lines for one property — the "Amount Settled By" table at
 * the bottom of the Property Cost Base panel.
 *
 * The body is read field by field rather than forwarded whole: the upstream
 * table has columns (org_id, created_by, is_deleted) that the browser must
 * never be able to set, and a blind passthrough would let it try.
 */
export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const items = await listCoreSettlementEntries(token, id);
    return NextResponse.json({ items });
  } catch (error) {
    return renderUpstreamError(
      `GET /api/properties/${id}/settlement-entries`,
      error,
    );
  }
}

export async function POST(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await context.params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = raw as Record<string, unknown>;
  const entryType =
    typeof body.entry_type === "string" ? body.entry_type.trim() : "";
  if (!entryType) {
    return NextResponse.json(
      { error: "entry_type is required" },
      { status: 400 },
    );
  }

  const payload: Record<string, unknown> = { entry_type: entryType };
  // Amount and position are optional on create: the grid adds an empty row and
  // fills it in, so a missing amount is a legitimate 0 rather than an error.
  if (typeof body.amount === "number" && Number.isFinite(body.amount)) {
    payload.amount = body.amount;
  }
  if (typeof body.description === "string") {
    payload.description = body.description;
  }
  if (typeof body.position === "number" && Number.isInteger(body.position)) {
    payload.position = body.position;
  }

  try {
    const entry = await createCoreSettlementEntry(token, id, payload);
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return renderUpstreamError(
      `POST /api/properties/${id}/settlement-entries`,
      error,
    );
  }
}
