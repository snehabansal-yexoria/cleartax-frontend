import { NextResponse } from "next/server";
import { CoreApiError, listReportTransactions } from "@/src/lib/coreApi";

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value;
}

function reportQuery(req: Request) {
  const sp = new URL(req.url).searchParams;
  return {
    period: sp.get("period") || undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    clientId: sp.get("clientId") || undefined,
  };
}

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }
  try {
    const data = await listReportTransactions(token, reportQuery(req));
    return NextResponse.json(data);
  } catch (error) {
    const status = error instanceof CoreApiError ? error.status : 502;
    const message = error instanceof Error ? error.message : "Failed to load transaction report";
    console.error("GET /api/reports/transactions error:", message);
    return NextResponse.json({ error: message }, { status });
  }
}
