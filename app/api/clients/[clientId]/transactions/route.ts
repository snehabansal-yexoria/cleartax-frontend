import { NextResponse } from "next/server";
import { listCoreTransactionsByClient } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { clientId } = await context.params;
  try {
    const items = await listCoreTransactionsByClient(token, clientId);
    return NextResponse.json({ items });
  } catch (error) {
    return renderUpstreamError(
      `GET /api/clients/${clientId}/transactions`,
      error,
    );
  }
}
