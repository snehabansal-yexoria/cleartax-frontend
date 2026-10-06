import { NextResponse } from "next/server";
import { getBearerToken } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ clientId: string }> };

function getCoreApiBaseUrl() {
  const baseUrl =
    process.env.CORE_API_BASE_URL || process.env.NEXT_PUBLIC_CORE_API_BASE_URL;
  if (!baseUrl) throw new Error("CORE_API_BASE_URL is not configured");
  return baseUrl.replace(/\/+$/, "");
}

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { clientId } = await context.params;

  try {
    const upstream = await fetch(
      `${getCoreApiBaseUrl()}/clients/${encodeURIComponent(clientId)}/export/csv`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error(
        `GET /api/clients/${clientId}/export-csv upstream error`,
        upstream.status,
        text.slice(0, 500),
      );
      return new NextResponse(text, {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Stream the CSV response through to the browser.
    const headers = new Headers();
    const contentDisposition = upstream.headers.get("content-disposition");
    if (contentDisposition) {
      headers.set("Content-Disposition", contentDisposition);
    }
    headers.set("Content-Type", "text/csv; charset=utf-8");

    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(
      `GET /api/clients/${clientId}/export-csv unexpected error`,
      message,
    );
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
