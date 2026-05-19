import { NextResponse } from "next/server";
import { coreApiRequest } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const qs = new URLSearchParams();
  for (const key of ["entity_id", "property_id", "owner_id"] as const) {
    const val = searchParams.get(key);
    if (val) qs.set(key, val);
  }

  try {
    const payload = await coreApiRequest(`/api/documents?${qs.toString()}`, { token });
    return NextResponse.json(payload);
  } catch (error) {
    return renderUpstreamError("GET /api/documents/list", error);
  }
}
