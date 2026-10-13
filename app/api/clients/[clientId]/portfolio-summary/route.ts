import { NextResponse } from "next/server";
import { getCorePortfolioSummaryForClient } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ clientId: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The client's Portfolio Summary for one financial year, optionally narrowed
 * to one of the client's entities or properties.
 *
 * Mirrors GET /api/entities/{id}/pnl-trend: `financial_year` is forwarded only
 * when it parses as a number, `entity_id` / `property_id` only when they are
 * UUIDs. Authorization is the core API's — a client asking for anyone but
 * themselves (or for an entity or property that isn't theirs) gets a 404,
 * which is forwarded as-is.
 */
export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { clientId } = await context.params;

  const params = new URL(req.url).searchParams;
  const parsed = Number.parseInt(params.get("financial_year") ?? "", 10);
  const financialYear = Number.isFinite(parsed) ? parsed : undefined;
  const rawEntityId = (params.get("entity_id") ?? "").trim();
  const entityId = UUID_RE.test(rawEntityId) ? rawEntityId : undefined;
  const rawPropertyId = (params.get("property_id") ?? "").trim();
  const propertyId = UUID_RE.test(rawPropertyId) ? rawPropertyId : undefined;

  try {
    const summary = await getCorePortfolioSummaryForClient(
      token,
      clientId,
      financialYear,
      entityId,
      propertyId,
    );
    return NextResponse.json(summary);
  } catch (error) {
    return renderUpstreamError(`GET /api/clients/${clientId}/portfolio-summary`, error);
  }
}
