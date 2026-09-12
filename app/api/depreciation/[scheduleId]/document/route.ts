import { NextResponse } from "next/server";
import { fetchCoreDepreciationDocument } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ scheduleId: string }> };

/**
 * GET /api/depreciation/{scheduleId}/document
 *
 * Streams the schedule PDF. The backend re-renders from the stored year rows if
 * the S3 object is missing, so this never 404s on a schedule that exists — it
 * may just be a moment slower.
 */
export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { scheduleId } = await context.params;
  try {
    const upstream = await fetchCoreDepreciationDocument(token, scheduleId);

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error(
        `GET /api/depreciation/${scheduleId}/document upstream error`,
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
    headers.set("Content-Type", upstream.headers.get("content-type") || "application/pdf");
    headers.set("Cache-Control", "no-store");

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (error) {
    return renderUpstreamError(`GET /api/depreciation/${scheduleId}/document`, error);
  }
}
