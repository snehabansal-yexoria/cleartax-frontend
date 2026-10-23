import { NextResponse } from "next/server";
import { listCoreInboxDocuments, type CoreInboxStatus } from "@/src/lib/coreApi";
import { getRequestToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ orgId: string }> };

const STATUSES = ["pending", "filed", "rejected", "discarded", "all"];

// GET /api/orgs/{orgId}/document-inbox?status=&client_id=&limit=&cursor=
// Emailed documents the caller may see: a client their own, an accountant
// their assigned (and unassigned) clients', an admin the whole org.
export async function GET(req: Request, context: RouteContext) {
  const token = getRequestToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }
  const { orgId } = await context.params;
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "pending";
  if (!STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "status must be pending, filed, rejected, discarded or all" },
      { status: 400 },
    );
  }
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 200)) {
    return NextResponse.json({ error: "limit must be 1-200" }, { status: 400 });
  }

  try {
    const page = await listCoreInboxDocuments(token, orgId, {
      status: status as CoreInboxStatus | "all",
      clientId: url.searchParams.get("client_id") || undefined,
      cursor: url.searchParams.get("cursor") || undefined,
      limit,
    });
    return NextResponse.json(page);
  } catch (error) {
    return renderUpstreamError(`GET /api/orgs/${orgId}/document-inbox`, error);
  }
}
