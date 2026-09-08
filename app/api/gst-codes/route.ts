import { NextResponse } from "next/server";
import { listCoreGstCodes } from "@/src/lib/coreApi";
import { getRequestToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

export async function GET(req: Request) {
  const token = getRequestToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  try {
    const items = await listCoreGstCodes(token);
    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    return renderUpstreamError("GET /api/gst-codes", error);
  }
}
