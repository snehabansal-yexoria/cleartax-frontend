import { NextResponse } from "next/server";
import {
  fetchCoreOpeningBalance,
  saveCoreOpeningBalance,
} from "@/src/lib/coreApi";
import { getRequestToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

/** 404 means none has been entered yet, which the page reads as "Add". */
export async function GET(req: Request, context: RouteContext) {
  const token = getRequestToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });
  const { id } = await context.params;

  try {
    return NextResponse.json(await fetchCoreOpeningBalance(token, id));
  } catch (error) {
    return renderUpstreamError(`GET /api/entities/${id}/opening-balance`, error);
  }
}

export async function PUT(req: Request, context: RouteContext) {
  const token = getRequestToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });
  const { id } = await context.params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = raw as { asAt?: unknown; lines?: unknown };
  if (typeof body.asAt !== "string" || !Array.isArray(body.lines)) {
    return NextResponse.json(
      { error: "asAt and lines are required" },
      { status: 400 },
    );
  }
  const lines = (body.lines as { code?: unknown; amount?: unknown }[]).map(
    (line) => ({ code: String(line.code ?? ""), amount: Number(line.amount) }),
  );

  try {
    const saved = await saveCoreOpeningBalance(token, id, {
      as_at: body.asAt,
      lines,
    });
    return NextResponse.json(saved);
  } catch (error) {
    return renderUpstreamError(`PUT /api/entities/${id}/opening-balance`, error);
  }
}
