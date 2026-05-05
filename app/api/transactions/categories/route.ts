import { NextResponse } from "next/server";
import {
  listCoreTransactionCategories,
  type CoreTransactionType,
} from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const url = new URL(req.url);
  const rawType = url.searchParams.get("type");
  const type: CoreTransactionType | undefined =
    rawType === "revenue" || rawType === "expense" ? rawType : undefined;

  try {
    const items = await listCoreTransactionCategories(token, type);
    return NextResponse.json({ items });
  } catch (error) {
    return renderUpstreamError(`GET /api/transactions/categories`, error);
  }
}
