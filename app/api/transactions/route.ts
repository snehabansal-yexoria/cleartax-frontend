import { NextResponse } from "next/server";
import { listCoreTransactionsForOrg } from "@/src/lib/coreApi";
import {
  getBearerToken,
  parseTransactionListQuery,
  renderUpstreamError,
} from "@/src/lib/coreApiProxy";

/**
 * GET /api/transactions — the org-wide list behind the "All Transactions" page.
 *
 * This route used to compensate for a missing backend endpoint by fanning out:
 * one upstream call per client, then per entity, then per property, merging
 * every row into a Map in Node memory before returning the lot to the browser.
 * For an org with 50 clients that was several hundred round trips per page
 * view, and it still returned truncated data because each upstream list capped
 * at 100 rows.
 *
 * GET /transactions on the Go API now answers the same question in one indexed
 * query, including the role scoping (a client sees only their own rows; an
 * accountant only their assigned clients) that used to be applied here in JS.
 */
export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  try {
    const page = await listCoreTransactionsForOrg(
      token,
      parseTransactionListQuery(req),
    );
    return NextResponse.json(page);
  } catch (error) {
    return renderUpstreamError("GET /api/transactions", error);
  }
}
