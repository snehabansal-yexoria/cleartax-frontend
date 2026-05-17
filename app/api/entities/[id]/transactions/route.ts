import { NextResponse } from "next/server";
import {
  createCoreTransactionForEntity,
  listCoreTransactionsByEntityPage,
} from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

function getPagination(req: Request) {
  const params = new URL(req.url).searchParams;
  const page = Math.max(1, Number(params.get("page") || 1));
  const pageSize = Math.min(
    100,
    Math.max(1, Number(params.get("pageSize") || params.get("page_size") || 9)),
  );
  return { page, pageSize };
}

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await context.params;
  const pagination = getPagination(req);
  try {
    const result = await listCoreTransactionsByEntityPage(token, id, pagination);
    const total = result.total ?? result.items.length;
    const shouldSlice = result.total == null || result.items.length > pagination.pageSize;
    const items = shouldSlice
      ? result.items.slice(
          (pagination.page - 1) * pagination.pageSize,
          pagination.page * pagination.pageSize,
        )
      : result.items;
    return NextResponse.json({
      items,
      total,
      unfilteredTotal: total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
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
