import { NextResponse } from "next/server";
import { coreApiRequest } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ entityId: string; ruleId: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  const { entityId, ruleId } = await context.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const data = await coreApiRequest(
      `/entities/${encodeURIComponent(entityId)}/transaction-rules/${encodeURIComponent(ruleId)}`,
      { token, method: "PATCH", body },
    );
    return NextResponse.json(data);
  } catch (error) {
    return renderUpstreamError(
      `PATCH /api/entities/${entityId}/transaction-rules/${ruleId}`,
      error,
      body,
    );
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  const { entityId, ruleId } = await context.params;
  try {
    await coreApiRequest(
      `/entities/${encodeURIComponent(entityId)}/transaction-rules/${encodeURIComponent(ruleId)}`,
      { token, method: "DELETE" },
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return renderUpstreamError(
      `DELETE /api/entities/${entityId}/transaction-rules/${ruleId}`,
      error,
    );
  }
}
