import { NextResponse } from "next/server";
import { actionCoreInboxDocument } from "@/src/lib/coreApi";
import { getRequestToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ orgId: string; docId: string }> };

// POST /api/orgs/{orgId}/document-inbox/{docId}/discard — body { reason? }.
// Not a document (signature, newsletter, duplicate); nobody is notified.
export async function POST(req: Request, context: RouteContext) {
  const token = getRequestToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }
  const { orgId, docId } = await context.params;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // An empty body is fine for discard; reject is caught by the check below.
  }
  const record = (body ?? {}) as Record<string, unknown>;
  const note = typeof record.reason === "string" ? record.reason : "";

  try {
    return NextResponse.json(
      await actionCoreInboxDocument(token, orgId, docId, "discard", note),
    );
  } catch (error) {
    return renderUpstreamError(
      `POST /api/orgs/${orgId}/document-inbox/${docId}/discard`,
      error,
      body,
    );
  }
}
