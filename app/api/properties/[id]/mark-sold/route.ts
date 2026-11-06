import { NextResponse } from "next/server";
import { markCorePropertySold } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });
  const { id } = await context.params;

  let raw: { sellingAmount?: unknown; soldDate?: unknown };
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sellingAmount = Number(raw.sellingAmount);
  if (!Number.isFinite(sellingAmount) || typeof raw.soldDate !== "string") {
    return NextResponse.json(
      { error: "sellingAmount and soldDate are required" },
      { status: 400 },
    );
  }

  try {
    await markCorePropertySold(token, id, {
      selling_amount: sellingAmount,
      sold_date: raw.soldDate,
    });
    return NextResponse.json({ sellingAmount, soldDate: raw.soldDate });
  } catch (error) {
    return renderUpstreamError(`POST /api/properties/${id}/mark-sold`, error);
  }
}
