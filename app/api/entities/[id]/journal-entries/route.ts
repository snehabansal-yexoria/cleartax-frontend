import { NextResponse } from "next/server";
import {
  createCoreJournalEntry,
  listCoreJournalEntriesByEntity,
} from "@/src/lib/coreApi";
import {
  getRequestToken,
  parseJournalEntryListQuery,
  renderUpstreamError,
} from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getRequestToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });
  const { id } = await context.params;

  try {
    const page = await listCoreJournalEntriesByEntity(
      token,
      id,
      parseJournalEntryListQuery(req),
    );
    return NextResponse.json(page);
  } catch (error) {
    return renderUpstreamError(`GET /api/entities/${id}/journal-entries`, error);
  }
}

export async function POST(req: Request, context: RouteContext) {
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
    const entry = await createCoreJournalEntry(
      token,
      id,
      body as Record<string, unknown>,
    );
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return renderUpstreamError(
      `POST /api/entities/${id}/journal-entries`,
      error,
      body,
    );
  }
}
