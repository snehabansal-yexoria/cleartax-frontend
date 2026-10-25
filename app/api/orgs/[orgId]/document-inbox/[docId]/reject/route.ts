import { NextResponse } from "next/server";
import { actionCoreInboxDocument } from "@/src/lib/coreApi";
import { getRequestToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ orgId: string; docId: string }> };

// POST /api/orgs/{orgId}/document-inbox/{docId}/reject — body { note }. The
// client sees the note, so it is required.
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
  const note = typeof record.note === "string" ? record.note : "";
  if (!note.trim()) {
    return NextResponse.json({ error: "note is required" }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await actionCoreInboxDocument(token, orgId, docId, "reject", note),
    );
  } catch (error) {
    return renderUpstreamError(
      `POST /api/orgs/${orgId}/document-inbox/${docId}/reject`,
      error,
      body,
    );
  }
}
