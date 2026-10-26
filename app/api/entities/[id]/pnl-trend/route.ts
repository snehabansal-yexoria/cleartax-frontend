import { NextResponse } from "next/server";
import { getCorePnlTrendByEntity } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Monthly income/expense trend for one entity across a financial year.
 *
 * Mirrors GET /api/properties/{id}/pnl: only `financial_year` is forwarded, and
 * only when it parses as a number. Until the backend route is deployed the
 * core API answers 404, which renderUpstreamError forwards as a structured
 * 404 — the client hook treats that as "fall back to bucketing transactions".
 */
export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await context.params;

  const raw = new URL(req.url).searchParams.get("financial_year");
  const parsed = Number.parseInt(raw ?? "", 10);
  const financialYear = Number.isFinite(parsed) ? parsed : undefined;

  try {
    const trend = await getCorePnlTrendByEntity(token, id, financialYear);
    return NextResponse.json(trend);
  } catch (error) {
    return renderUpstreamError(`GET /api/entities/${id}/pnl-trend`, error);
  }
}
