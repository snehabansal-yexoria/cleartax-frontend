import { NextResponse } from "next/server";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";
import { listReconciliations } from "@/src/lib/coreApi";

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
    const items = await listReconciliations(token, entityId);
    return NextResponse.json(items);
  } catch (error) {
    return renderUpstreamError(`GET /api/entities/${entityId}/reconciliations`, error);
  }
}
