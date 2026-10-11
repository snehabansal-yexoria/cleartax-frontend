import { NextResponse } from "next/server";
import { getCorePortfolioSummaryForClient } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ clientId: string }> };

/**
 * The client's Portfolio Summary for one financial year.
 *
 * Mirrors GET /api/entities/{id}/pnl-trend: only `financial_year` is forwarded,
 * and only when it parses as a number. Authorization is the core API's — a
 * client asking for anyone but themselves gets a 404, which is forwarded as-is.
 */
export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { clientId } = await context.params;

  const raw = new URL(req.url).searchParams.get("financial_year");
  const parsed = Number.parseInt(raw ?? "", 10);
  const financialYear = Number.isFinite(parsed) ? parsed : undefined;

  try {
    const summary = await getCorePortfolioSummaryForClient(token, clientId, financialYear);
    return NextResponse.json(summary);
  } catch (error) {
    return renderUpstreamError(`GET /api/clients/${clientId}/portfolio-summary`, error);
  }
}
