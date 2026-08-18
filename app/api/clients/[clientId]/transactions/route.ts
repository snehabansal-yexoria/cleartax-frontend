import { NextResponse } from "next/server";
import {
  listCoreTransactionsByClient,
  toCoreReviewStatusParam,
  type CoreReviewStatus,
} from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";
import { findDirectoryUserByIdentity } from "@/src/lib/userDirectory";

type RouteContext = { params: Promise<{ clientId: string }> };

async function listTransactionsFromClientProperties(
  token: string,
  clientId: string,
  reviewStatus?: CoreReviewStatus,
) {
  const [items, client] = await Promise.all([
    listCoreTransactionsByClient(token, clientId, reviewStatus),
    findDirectoryUserByIdentity({ id: clientId }),
  ]);
  const clientName = client?.fullName ?? "";

  const enriched = items.map((item) => ({
    ...item,
    clientName: item.clientName || clientName,
  }));

  return enriched.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
}

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { clientId } = await context.params;
  const reviewStatus = toCoreReviewStatusParam(
    new URL(req.url).searchParams.get("review_status"),
  );
  try {
    const items = await listTransactionsFromClientProperties(
      token,
      clientId,
      reviewStatus,
    );
    return NextResponse.json({ items });
  } catch (error) {
    return renderUpstreamError(
      `GET /api/clients/${clientId}/transactions`,
      error,
    );
  }
}
