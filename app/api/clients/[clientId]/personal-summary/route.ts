import { NextResponse } from "next/server";
import { getCorePersonalSummaryForClient } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { clientId } = await context.params;
  try {
    const summary = await getCorePersonalSummaryForClient(token, clientId);
    return NextResponse.json(summary);
  } catch (error) {
    return renderUpstreamError(
      `GET /api/clients/${clientId}/personal-summary`,
      error,
    );
  }
}
