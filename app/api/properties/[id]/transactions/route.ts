import { NextResponse } from "next/server";
import {
  listCoreTransactionsByProperty,
  toCoreReviewStatusParam,
} from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await context.params;
  const reviewStatus = toCoreReviewStatusParam(
    new URL(req.url).searchParams.get("review_status"),
  );
  try {
    const items = await listCoreTransactionsByProperty(token, id, reviewStatus);
    return NextResponse.json({ items });
  } catch (error) {
    return renderUpstreamError(
      `GET /api/properties/${id}/transactions`,
      error,
    );
  }
}
