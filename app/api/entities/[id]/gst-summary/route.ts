import { NextResponse } from "next/server";
import { getCoreGstSummaryByEntity, toCoreGstQuery } from "@/src/lib/coreApi";
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
    const summary = await getCoreGstSummaryByEntity(token, id, query);
    return NextResponse.json(summary);
  } catch (error) {
    return renderUpstreamError(`GET /api/entities/${id}/gst-summary`, error);
  }
}
