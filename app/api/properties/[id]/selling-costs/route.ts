import { NextResponse } from "next/server";
import { saveCoreSellingCosts } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

/** Replaces the property's selling costs. An empty list clears them. */
export async function POST(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });
  const { id } = await context.params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "Expected a list of rows" }, { status: 400 });
  }

  const rows = (raw as Record<string, unknown>[]).map((row) => ({
    subcategory: row.subcategory,
    description: row.description,
    date: row.date,
    amount: row.amount,
  }));

  try {
    const items = await saveCoreSellingCosts(token, id, rows);
    return NextResponse.json({ items });
  } catch (error) {
    return renderUpstreamError(`POST /api/properties/${id}/selling-costs`, error);
  }
}
