import { NextResponse } from "next/server";
import { getCoreTransactionTotals } from "@/src/lib/coreApi";
import {
  getBearerToken,
  parseTransactionListQuery,
  renderUpstreamError,
} from "@/src/lib/coreApiProxy";

/**
 * GET /api/transactions/totals — the Income and Expense cards above a
 * transaction list: totals for the same filters and review tab as the list,
 * ignoring its type filter. Role scoping (a client totals only their own
 * entities) is the Go API's, as for the list itself.
 */
export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  try {
    const totals = await getCoreTransactionTotals(
      token,
      parseTransactionListQuery(req),
    );
    return NextResponse.json(totals);
  } catch (error) {
    return renderUpstreamError("GET /api/transactions/totals", error);
  }
}
