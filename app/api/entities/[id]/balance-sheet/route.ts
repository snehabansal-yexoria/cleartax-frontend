import { NextResponse } from "next/server";
import { fetchCoreBalanceSheet } from "@/src/lib/coreApi";
import {
  getRequestToken,
  parseBalanceSheetQuery,
  renderUpstreamError,
} from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getRequestToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });
  const { id } = await context.params;

  try {
    const sheet = await fetchCoreBalanceSheet(token, id, parseBalanceSheetQuery(req));
    return NextResponse.json(sheet);
  } catch (error) {
    return renderUpstreamError(`GET /api/entities/${id}/balance-sheet`, error);
  }
}
