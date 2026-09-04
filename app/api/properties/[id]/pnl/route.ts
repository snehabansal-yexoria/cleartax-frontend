import { NextResponse } from "next/server";
import { getCorePnlSummaryByProperty } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await context.params;

  // Only `financial_year` is forwarded, and only when it parses as a number.
  // The core API has no from/to escape hatch here on purpose: a P&L is a
  // financial-year statement, and the bounded window is what keeps the query
  // fast as a portfolio accumulates years.
  const raw = new URL(req.url).searchParams.get("financial_year");
  const parsed = Number.parseInt(raw ?? "", 10);
  const financialYear = Number.isFinite(parsed) ? parsed : undefined;

  try {
    const summary = await getCorePnlSummaryByProperty(token, id, financialYear);
    return NextResponse.json(summary);
  } catch (error) {
    return renderUpstreamError(`GET /api/properties/${id}/pnl`, error);
  }
}
