import { NextResponse } from "next/server";
import { fetchCoreBalanceSheetExport } from "@/src/lib/coreApi";
import {
  getRequestToken,
  parseBalanceSheetQuery,
  renderUpstreamError,
} from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getRequestToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });
  const { id } = await context.params;

  const query = parseBalanceSheetQuery(req);
  if (!query.format) query.format = "csv";

  try {
    const upstream = await fetchCoreBalanceSheetExport(token, id, query);

    if (!upstream.ok) {
      const text = await upstream.text();
      return new NextResponse(text, {
        status: upstream.status,
        headers: {
          "Content-Type":
            upstream.headers.get("content-type") ?? "application/json",
        },
      });
    }

    // Stream the body through rather than buffering the whole file.
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/octet-stream",
        "Content-Disposition":
          upstream.headers.get("content-disposition") ??
          `attachment; filename="balance-sheet.${query.format}"`,
      },
    });
  } catch (error) {
    return renderUpstreamError(
      `GET /api/entities/${id}/balance-sheet/export`,
      error,
    );
  }
}
