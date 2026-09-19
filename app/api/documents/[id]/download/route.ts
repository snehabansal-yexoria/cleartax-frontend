import { NextResponse } from "next/server";
import { CORE_DOCUMENTS_TIMEOUT_MS, coreApiRequest } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  const { id } = await params;
  try {
    const payload = await coreApiRequest(
      `/api/documents/${encodeURIComponent(id)}/download`,
      { token, timeoutMs: CORE_DOCUMENTS_TIMEOUT_MS },
    );
    return NextResponse.json(payload);
  } catch (error) {
    return renderUpstreamError(`GET /api/documents/${id}/download`, error);
  }
}
