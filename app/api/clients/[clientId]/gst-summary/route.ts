import { NextResponse } from "next/server";
import { getCoreGstSummaryForClient, toCoreGstQuery } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { clientId } = await context.params;
  const query = toCoreGstQuery(new URL(req.url).searchParams);
  try {
    const summary = await getCoreGstSummaryForClient(token, clientId, query);
    return NextResponse.json(summary);
  } catch (error) {
    return renderUpstreamError(
      `GET /api/clients/${clientId}/gst-summary`,
      error,
    );
  }
}
