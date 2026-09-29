import { NextResponse } from "next/server";
import { fetchCoreGeneralLedger } from "@/src/lib/coreApi";
import {
  getRequestToken,
  parseGeneralLedgerQuery,
  renderUpstreamError,
} from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getRequestToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });
  const { id } = await context.params;

  try {
    const ledger = await fetchCoreGeneralLedger(
      token,
      id,
      parseGeneralLedgerQuery(req),
    );
    return NextResponse.json(ledger);
  } catch (error) {
    return renderUpstreamError(`GET /api/entities/${id}/general-ledger`, error);
  }
}
