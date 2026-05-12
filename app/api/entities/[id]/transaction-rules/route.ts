import { NextResponse } from "next/server";
import { coreApiRequest } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  const { id } = await context.params;
  try {
    const data = await coreApiRequest(
      `/entities/${encodeURIComponent(id)}/transaction-rules`,
      { token },
    );
    return NextResponse.json(data);
  } catch (error) {
    return renderUpstreamError(`GET /api/entities/${id}/transaction-rules`, error);
  }
}

export async function POST(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const data = await coreApiRequest(
      `/entities/${encodeURIComponent(id)}/transaction-rules`,
      { token, method: "POST", body },
    );
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return renderUpstreamError(`POST /api/entities/${id}/transaction-rules`, error, body);
  }
}
