import { NextResponse } from "next/server";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";
import type { ReconciliationSessionStatus } from "@/src/lib/coreApi";
import {
  getReconciliationSession,
  updateReconciliationSession,
} from "@/src/lib/coreApi";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }
  const { id: entityId, sessionId } = await params;
  try {
    const session = await getReconciliationSession(token, entityId, sessionId);
    return NextResponse.json(session);
  } catch (error) {
    return renderUpstreamError(
      `GET /api/entities/${entityId}/reconciliation-sessions/${sessionId}`,
      error,
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }
  const { id: entityId, sessionId } = await params;

  let body: {
    label?: string;
    periodFrom?: string | null;
    periodTo?: string | null;
    status?: ReconciliationSessionStatus;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const session = await updateReconciliationSession(
      token,
      entityId,
      sessionId,
      body,
    );
    return NextResponse.json(session);
  } catch (error) {
    return renderUpstreamError(
      `PATCH /api/entities/${entityId}/reconciliation-sessions/${sessionId}`,
      error,
      body,
    );
  }
}
