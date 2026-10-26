import { NextResponse } from "next/server";
import { getCorePersonalSummaryForProperty, toCoreGstQuery } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const summary = await getCorePersonalSummaryForProperty(
      token,
      id,
      // Optional BAS period (financial_year, quarter, from/to); none = all time.
      toCoreGstQuery(new URL(req.url).searchParams),
    );
    return NextResponse.json(summary);
  } catch (error) {
    return renderUpstreamError(
      `GET /api/properties/${id}/personal-summary`,
      error,
    );
  }
}
