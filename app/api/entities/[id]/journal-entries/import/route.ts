import { NextResponse } from "next/server";
import { importCoreJournalEntries } from "@/src/lib/coreApi";
import { getRequestToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Bulk journal import. `?dry_run=true` validates without writing, so the UI can
 * show a full per-row preview before anything is committed.
 */
export async function POST(req: Request, context: RouteContext) {
  const token = getRequestToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });
  const { id } = await context.params;

  const dryRun = new URL(req.url).searchParams.get("dry_run") === "true";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await importCoreJournalEntries(
      token,
      id,
      body as Record<string, unknown>,
      dryRun,
    );
    return NextResponse.json(result);
  } catch (error) {
    return renderUpstreamError(
      `POST /api/entities/${id}/journal-entries/import`,
      error,
      body,
    );
  }
}
