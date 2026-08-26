import { NextResponse } from "next/server";
import { listCoreTransactionsByProperty } from "@/src/lib/coreApi";
import {
  getBearerToken,
  parseTransactionListQuery,
  renderUpstreamError,
} from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const page = await listCoreTransactionsByProperty(
      token,
      id,
      parseTransactionListQuery(req),
    );
    return NextResponse.json(page);
  } catch (error) {
    return renderUpstreamError(
      `GET /api/properties/${id}/transactions`,
      error,
    );
  }
}
