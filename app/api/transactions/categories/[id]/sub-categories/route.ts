import { NextResponse } from "next/server";
import { listCoreTransactionSubcategories } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await context.params;
  const categoryId = Number.parseInt(id, 10);
  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    return NextResponse.json({ error: "Invalid category id" }, { status: 400 });
  }

  try {
    const items = await listCoreTransactionSubcategories(token, categoryId);
    return NextResponse.json({ items });
  } catch (error) {
    return renderUpstreamError(
      `GET /api/transactions/categories/${id}/sub-categories`,
      error,
    );
  }
}
