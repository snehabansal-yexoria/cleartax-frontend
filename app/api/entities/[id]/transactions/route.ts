import { NextResponse } from "next/server";
import {
  createCoreTransactionForEntity,
  listCoreTransactionsByEntity,
} from "@/src/lib/coreApi";
import {
  getBearerToken,
  parseTransactionListQuery,
  renderUpstreamError,
} from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const page = await listCoreTransactionsByEntity(
      token,
      id,
      parseTransactionListQuery(req),
    );
    return NextResponse.json(page);
  } catch (error) {
    return renderUpstreamError(`GET /api/entities/${id}/transactions`, error);
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
    const transaction = await createCoreTransactionForEntity(
      token,
      id,
      body as Record<string, unknown>,
    );
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    return renderUpstreamError(
      `POST /api/entities/${id}/transactions`,
      error,
      body,
    );
  }
}
