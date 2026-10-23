import { NextResponse } from "next/server";
import { getCoreInboxDocument } from "@/src/lib/coreApi";
import { getRequestToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ orgId: string; docId: string }> };

// GET /api/orgs/{orgId}/document-inbox/{docId} — one emailed document plus a
// short-lived viewUrl for the preview.
export async function GET(req: Request, context: RouteContext) {
  const token = getRequestToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }
  const { orgId, docId } = await context.params;
  try {
    return NextResponse.json(await getCoreInboxDocument(token, orgId, docId));
  } catch (error) {
    return renderUpstreamError(`GET /api/orgs/${orgId}/document-inbox/${docId}`, error);
  }
}
