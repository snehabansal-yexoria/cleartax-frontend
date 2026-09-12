import { NextResponse } from "next/server";
import { listCoreTransactionsByClient } from "@/src/lib/coreApi";
import {
  getBearerToken,
  parseTransactionListQuery,
  renderUpstreamError,
} from "@/src/lib/coreApiProxy";
import { findDirectoryUserByIdentity } from "@/src/lib/userDirectory";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { clientId } = await context.params;

  try {
    // The core API scopes and sorts the page; the directory lookup only fills
    // in the client's display name when the upstream row lacks one.
    const [page, client] = await Promise.all([
      listCoreTransactionsByClient(
        token,
        clientId,
        parseTransactionListQuery(req),
      ),
      findDirectoryUserByIdentity({ id: clientId }),
    ]);
    const clientName = client?.fullName ?? "";

    return NextResponse.json({
      ...page,
      items: page.items.map((item) => ({
        ...item,
        clientName: item.clientName || clientName,
      })),
    });
  } catch (error) {
    return renderUpstreamError(
      `GET /api/clients/${clientId}/transactions`,
      error,
    );
  }
}
