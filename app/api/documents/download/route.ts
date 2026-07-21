import { NextResponse } from "next/server";
import { coreApiRequest } from "@/src/lib/coreApi";
import { getRequestToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

// Serves document/property images referenced by their raw S3 key, e.g.
// <img src="/api/documents/download?key=<s3_key>">. Two things make this route
// different from the by-id download route:
//  1. It reads the token from the `idToken` cookie as well as the Authorization
//     header (via getRequestToken) — <img> requests never carry an Authorization
//     header, so cookie auth is the only thing that works for them.
//  2. It 302-redirects the browser straight to the short-lived presigned S3 URL
//     the backend returns, so the <img> can load the bytes directly.
export async function GET(req: Request) {
  const token = getRequestToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  const key = new URL(req.url).searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  try {
    const payload = (await coreApiRequest(
      `/api/documents/download?key=${encodeURIComponent(key)}`,
      { token },
    )) as { download_url?: string };

    if (!payload?.download_url) {
      return NextResponse.json(
        { error: "No download URL returned" },
        { status: 502 },
      );
    }

    return NextResponse.redirect(payload.download_url, 302);
  } catch (error) {
    return renderUpstreamError("GET /api/documents/download", error);
  }
}
