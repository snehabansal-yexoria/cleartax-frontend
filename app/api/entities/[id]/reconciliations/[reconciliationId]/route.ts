import { NextResponse } from "next/server";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";
import { getReconciliation } from "@/src/lib/coreApi";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; reconciliationId: string }> },
) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id: entityId, reconciliationId } = await params;

  try {
    const detail = await getReconciliation(token, entityId, reconciliationId);
    return NextResponse.json(detail);
  } catch (error) {
    return renderUpstreamError(
      `GET /api/entities/${entityId}/reconciliations/${reconciliationId}`,
      error,
    );
  }
}
