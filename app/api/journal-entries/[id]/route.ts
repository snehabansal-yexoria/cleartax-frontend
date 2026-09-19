import { NextResponse } from "next/server";
import {
  deleteCoreJournalEntry,
  getCoreJournalEntry,
  updateCoreJournalEntry,
} from "@/src/lib/coreApi";
import { getRequestToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getRequestToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });
  const { id } = await context.params;

  try {
    return NextResponse.json(await getCoreJournalEntry(token, id));
  } catch (error) {
    return renderUpstreamError(`GET /api/journal-entries/${id}`, error);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const token = getRequestToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const entry = await updateCoreJournalEntry(
      token,
      id,
      body as Record<string, unknown>,
    );
    return NextResponse.json(entry);
  } catch (error) {
    return renderUpstreamError(`PATCH /api/journal-entries/${id}`, error, body);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const token = getRequestToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });
  const { id } = await context.params;

  try {
    await deleteCoreJournalEntry(token, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return renderUpstreamError(`DELETE /api/journal-entries/${id}`, error);
  }
}
