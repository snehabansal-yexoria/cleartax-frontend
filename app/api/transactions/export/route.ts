import { NextResponse } from "next/server";
import {
  fetchCoreTransactionExport,
  type CoreTransactionExportFormat,
} from "@/src/lib/coreApi";
import {
  getBearerToken,
  parseTransactionListQuery,
  renderUpstreamError,
} from "@/src/lib/coreApiProxy";

function parseFormat(value: string | null): CoreTransactionExportFormat {
  const s = (value ?? "").trim().toLowerCase();
  if (s === "xlsx" || s === "excel") return "xlsx";
  if (s === "pdf") return "pdf";
  return "csv";
}

/**
 * GET /api/transactions/export?format=csv|xlsx|pdf
 *
 * Exports the whole filter set, not the loaded page — the same search, date
 * range, filters and sort the grid is showing. The upstream body is piped
 * straight through rather than buffered, mirroring the client-bundle export at
 * app/api/clients/[clientId]/export-csv/route.ts.
 */
export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const format = parseFormat(new URL(req.url).searchParams.get("format"));

  try {
    const upstream = await fetchCoreTransactionExport(
      token,
      format,
      parseTransactionListQuery(req),
    );

    if (!upstream.ok) {
      // Over-cap exports come back as a structured 400 ("narrow the filters"),
      // which the UI shows verbatim — forward it rather than flattening to 502.
      const text = await upstream.text();
      console.error(
        "GET /api/transactions/export upstream error",
        upstream.status,
        text.slice(0, 500),
      );
      return new NextResponse(text, {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const headers = new Headers();
    const disposition = upstream.headers.get("content-disposition");
    if (disposition) headers.set("Content-Disposition", disposition);
    headers.set(
      "Content-Type",
      upstream.headers.get("content-type") || "application/octet-stream",
    );
    headers.set("Cache-Control", "no-store");

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (error) {
    return renderUpstreamError("GET /api/transactions/export", error);
  }
}
