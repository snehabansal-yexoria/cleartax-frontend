import { NextResponse } from "next/server";
import { getCoreInboxAddress } from "@/src/lib/coreApi";
import { getRequestToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ orgId: string }> };

// GET /api/orgs/{orgId}/document-inbox/address — the address clients email
// documents to, and whether intake is switched on.
export async function GET(req: Request, context: RouteContext) {
  const token = getRequestToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }
  const { orgId } = await context.params;
  try {
    return NextResponse.json(await getCoreInboxAddress(token, orgId));
  } catch (error) {
    return renderUpstreamError(`GET /api/orgs/${orgId}/document-inbox/address`, error);
  }
}
