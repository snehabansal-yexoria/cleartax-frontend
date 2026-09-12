import { NextResponse } from "next/server";
import { getCoreGstSummaryByProperty, toCoreGstQuery } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await context.params;
  const query = toCoreGstQuery(new URL(req.url).searchParams);
  try {
    const summary = await getCoreGstSummaryByProperty(token, id, query);
    return NextResponse.json(summary);
  } catch (error) {
    return renderUpstreamError(`GET /api/properties/${id}/gst-summary`, error);
  }
}
