import { NextResponse } from "next/server";
import { getCoreTransactionFacets } from "@/src/lib/coreApi";
import {
  getBearerToken,
  parseTransactionListQuery,
  renderUpstreamError,
} from "@/src/lib/coreApiProxy";

/**
 * GET /api/transactions/facets — filter dropdown options plus review-status
 * counts for the current scope.
 *
 * The grid derived both from its fully loaded row array. Now that the list is
 * paginated that array is a single page, so the dropdowns would only offer
 * values visible on that page and the tab badges would count 50 rows instead
 * of the whole set.
 */
export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  try {
    const facets = await getCoreTransactionFacets(
      token,
      parseTransactionListQuery(req),
    );
    return NextResponse.json(facets);
  } catch (error) {
    return renderUpstreamError("GET /api/transactions/facets", error);
  }
}
