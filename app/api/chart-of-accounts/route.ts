import { NextResponse } from "next/server";
import { listCoreChartOfAccounts } from "@/src/lib/coreApi";
import { getRequestToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

const CATEGORIES = new Set([
  "income",
  "expense",
  "asset",
  "liability",
  "equity",
]);

export async function GET(req: Request) {
  const token = getRequestToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  // Read each parameter by name and validate it rather than forwarding the raw
  // query string. The Go API whitelists again; this is the first gate.
  const url = new URL(req.url);
  const category = url.searchParams.get("category") ?? "";
  const search = url.searchParams.get("search") ?? "";
  const postable = url.searchParams.get("postable") === "true";

  try {
    const items = await listCoreChartOfAccounts(token, {
      category: CATEGORIES.has(category) ? category : undefined,
      search: search.trim() || undefined,
      postable,
    });
    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    return renderUpstreamError("GET /api/chart-of-accounts", error);
  }
}
