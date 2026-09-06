import { NextResponse } from "next/server";
import {
  deleteCoreSettlementEntry,
  updateCoreSettlementEntry,
} from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string; entryId: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id, entryId } = await context.params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = raw as Record<string, unknown>;
  const payload: Record<string, unknown> = {};

  if (typeof body.entry_type === "string") {
    const entryType = body.entry_type.trim();
    if (!entryType) {
      return NextResponse.json(
        { error: "entry_type must not be blank" },
        { status: 400 },
      );
    }
    payload.entry_type = entryType;
  }
  if (typeof body.amount === "number" && Number.isFinite(body.amount)) {
    payload.amount = body.amount;
  }
  // Description is the one clearable field, so an explicit null is forwarded
  // rather than dropped — that is how the accountant empties the cell.
  if (typeof body.description === "string" || body.description === null) {
    payload.description = body.description;
  }
  if (typeof body.position === "number" && Number.isInteger(body.position)) {
    payload.position = body.position;
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const entry = await updateCoreSettlementEntry(token, id, entryId, payload);
    return NextResponse.json(entry);
  } catch (error) {
    return renderUpstreamError(
      `PATCH /api/properties/${id}/settlement-entries/${entryId}`,
      error,
    );
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id, entryId } = await context.params;
  try {
    await deleteCoreSettlementEntry(token, id, entryId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return renderUpstreamError(
      `DELETE /api/properties/${id}/settlement-entries/${entryId}`,
      error,
    );
  }
}
