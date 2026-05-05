import { NextResponse } from "next/server";
import {
  getCoreTransaction,
  updateCoreTransaction,
} from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const transaction = await getCoreTransaction(token, id);
    return NextResponse.json(transaction);
  } catch (error) {
    return renderUpstreamError(`GET /api/transactions/${id}`, error);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
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
    const transaction = await updateCoreTransaction(
      token,
      id,
      body as Record<string, unknown>,
    );
    return NextResponse.json(transaction);
  } catch (error) {
    return renderUpstreamError(`PATCH /api/transactions/${id}`, error, body);
  }
}
