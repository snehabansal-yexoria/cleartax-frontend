import { NextResponse } from "next/server";
import { createCoreProperty, listCoreProperties } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const items = await listCoreProperties(token, id);
    return NextResponse.json({ items });
  } catch (error) {
    // Forward the upstream status rather than flattening everything to 502, so
    // a 401/403/404 reaches the page as what it is.
    return renderUpstreamError(`GET /api/entities/${id}/properties`, error);
  }
}

export async function POST(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    // createCoreProperty already authorises against the entity upstream; the
    // extra getCoreEntity round trip that used to sit here bought nothing.
    const property = await createCoreProperty(
      token,
      id,
      body as Record<string, unknown>,
    );
    return NextResponse.json(property, { status: 201 });
  } catch (error) {
    return renderUpstreamError(`POST /api/entities/${id}/properties`, error, body);
  }
}
