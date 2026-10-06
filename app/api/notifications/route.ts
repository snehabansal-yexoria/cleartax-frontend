import { NextResponse } from "next/server";
import {
  CoreApiError,
  getCoreApiBearerFromRequest,
  listCoreNotifications,
  NOTIFICATION_CATEGORIES,
} from "@/src/lib/coreApi";
import { logError } from "@/src/lib/log";

// GET /api/notifications?limit=&cursor=&category=
// Proxies the signed-in user's notifications from the core API. The backend
// resolves the recipient from the bearer token, so nothing here names a user.
export async function GET(req: Request) {
  const token = getCoreApiBearerFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const limit = Number.parseInt(params.get("limit") || "", 10);
  const cursor = params.get("cursor") || undefined;
  const category = params.get("category") || undefined;

  if (
    category &&
    !(NOTIFICATION_CATEGORIES as readonly string[]).includes(category)
  ) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }

  try {
    const page = await listCoreNotifications(token, {
      limit: Number.isNaN(limit) ? undefined : limit,
      cursor,
      category,
    });
    return NextResponse.json(page);
  } catch (error) {
    if (error instanceof CoreApiError && error.status < 500) {
      return NextResponse.json(
        { error: error.upstreamMessage || "Failed to load notifications" },
        { status: error.status },
      );
    }
    logError("List notifications failed", error, {
      route: "GET /api/notifications",
    });
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 502 },
    );
  }
}
