import { NextResponse } from "next/server";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";
import {
  createReconciliationSession,
  listReconciliationSessions,
} from "@/src/lib/coreApi";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }
  const { id: entityId } = await params;
  try {
    const items = await listReconciliationSessions(token, entityId);
    return NextResponse.json(items);
  } catch (error) {
    return renderUpstreamError(
      `GET /api/entities/${entityId}/reconciliation-sessions`,
      error,
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }
  const { id: entityId } = await params;

  let body: { label?: string; periodFrom?: string | null; periodTo?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.label || typeof body.label !== "string" || !body.label.trim()) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  try {
    const session = await createReconciliationSession(token, entityId, {
      label: body.label.trim(),
      periodFrom: body.periodFrom ?? null,
      periodTo: body.periodTo ?? null,
    });
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    return renderUpstreamError(
      `POST /api/entities/${entityId}/reconciliation-sessions`,
      error,
      body,
    );
  }
}
