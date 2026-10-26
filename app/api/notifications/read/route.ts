import { NextResponse } from "next/server";
import {
  CoreApiError,
  getCoreApiBearerFromRequest,
  markCoreNotificationsRead,
} from "@/src/lib/coreApi";
import { logError } from "@/src/lib/log";

const MAX_IDS = 200;

// POST /api/notifications/read  body: {"ids": [...]} | {"all": true}
// Marks the signed-in user's notifications read. The backend resolves the
// recipient from the bearer token and only updates that recipient's rows, so
// nothing here names a user.
export async function POST(req: Request) {
  const token = getCoreApiBearerFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { ids?: unknown; all?: unknown }
    | null;

  let payload: { ids: string[] } | { all: true };
  if (body?.all === true && body.ids === undefined) {
    payload = { all: true };
  } else if (Array.isArray(body?.ids) && body.all === undefined) {
    const ids = body.ids.map((id) => String(id).trim()).filter(Boolean);
    if (ids.length === 0 || ids.length > MAX_IDS) {
      return NextResponse.json(
        { error: `Send between 1 and ${MAX_IDS} ids.` },
        { status: 400 },
      );
    }
    payload = { ids };
  } else {
    return NextResponse.json(
      { error: 'Send either {"ids": [...]} or {"all": true}.' },
      { status: 400 },
    );
  }

  try {
    const result = await markCoreNotificationsRead(token, payload);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CoreApiError && error.status < 500) {
      return NextResponse.json(
        { error: error.upstreamMessage || "Failed to mark notifications read" },
        { status: error.status },
      );
    }
    logError("Mark notifications read failed", error, {
      route: "POST /api/notifications/read",
    });
    return NextResponse.json(
      { error: "Failed to mark notifications read" },
      { status: 502 },
    );
  }
}
