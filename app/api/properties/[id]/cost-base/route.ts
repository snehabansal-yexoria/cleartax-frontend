import { NextResponse } from "next/server";
import {
  createCoreCostBaseEntry,
  listCoreCostBaseEntries,
} from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Manual cost base lines for one property — the Property Cost Base table.
 *
 * These used to be browser state with no table behind them, beside an
 * auto-filled list read from cost_base transactions. The auto-filled list now
 * renders under Settlement Entries, so these rows ARE the cost base and have to
 * survive a reload.
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
    const items = await listCoreCostBaseEntries(token, id);
    return NextResponse.json({ items });
  } catch (error) {
    return renderUpstreamError(`GET /api/properties/${id}/cost-base`, error);
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
  const category =
    typeof body.category === "string" ? body.category.trim() : "";
  if (!category) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }

  const payload: Record<string, unknown> = { category };
  // Amounts and position are optional on create: the grid adds an empty row and
  // fills it in, so a missing gross is a legitimate 0 rather than an error.
  if (
    typeof body.gross_amount === "number" &&
    Number.isFinite(body.gross_amount)
  ) {
    payload.gross_amount = body.gross_amount;
  }
  if (typeof body.gst_amount === "number" && Number.isFinite(body.gst_amount)) {
    payload.gst_amount = body.gst_amount;
  }
  if (typeof body.description === "string") {
    payload.description = body.description;
  }
  if (typeof body.position === "number" && Number.isInteger(body.position)) {
    payload.position = body.position;
  }

  try {
    const entry = await createCoreCostBaseEntry(token, id, payload);
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return renderUpstreamError(`POST /api/properties/${id}/cost-base`, error);
  }
}
