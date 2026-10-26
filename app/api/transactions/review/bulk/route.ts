import { NextResponse } from "next/server";
import {
  bulkReviewCoreTransactions,
  type CoreReviewAction,
} from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

const REVIEW_ACTIONS: CoreReviewAction[] = ["approve", "reject", "reset"];

// POST /api/transactions/review/bulk — apply one review action to up to 200
// transactions. Accountant/admin only. Body:
// { ids: string[], action: "approve" | "reject" | "reset", note?: string }.
// Rows fail independently; the response reports per-id results.
export async function POST(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const action = typeof record.action === "string" ? record.action : "";
  if (!REVIEW_ACTIONS.includes(action as CoreReviewAction)) {
    return NextResponse.json(
      { error: "action must be 'approve', 'reject' or 'reset'" },
      { status: 400 },
    );
  }
  const ids = Array.isArray(record.ids)
    ? record.ids.filter((id): id is string => typeof id === "string")
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids is required" }, { status: 400 });
  }
  const note = typeof record.note === "string" ? record.note : undefined;

  try {
    const result = await bulkReviewCoreTransactions(
      token,
      ids,
      action as CoreReviewAction,
      note,
    );
    return NextResponse.json(result);
  } catch (error) {
    return renderUpstreamError("POST /api/transactions/review/bulk", error, body);
  }
}
