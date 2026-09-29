import { NextResponse } from "next/server";
import { CoreApiError, getReportClient } from "@/src/lib/coreApi";

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value;
}

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }
  const { clientId } = await context.params;
  const sp = new URL(req.url).searchParams;
  const query = {
    period: sp.get("period") || undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
  };
  try {
    const data = await getReportClient(token, clientId, query);
    return NextResponse.json(data);
  } catch (error) {
    const status = error instanceof CoreApiError ? error.status : 502;
    const message = error instanceof Error ? error.message : "Failed to load client report";
    console.error(`GET /api/reports/clients/${clientId} error:`, message);
    return NextResponse.json({ error: message }, { status });
  }
}
