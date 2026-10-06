import { NextResponse } from "next/server";
import {
  reviewCoreTransaction,
  type CoreReviewAction,
} from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

const REVIEW_ACTIONS: CoreReviewAction[] = ["approve", "reject", "reset"];

// POST /api/transactions/{id}/review — approve, reject, or reset one
// transaction's review status. Accountant/admin only (the core API 403s
// clients). Body: { action: "approve" | "reject" | "reset", note?: string }.
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

  const record = (body ?? {}) as Record<string, unknown>;
  const action = typeof record.action === "string" ? record.action : "";
  if (!REVIEW_ACTIONS.includes(action as CoreReviewAction)) {
    return NextResponse.json(
      { error: "action must be 'approve', 'reject' or 'reset'" },
      { status: 400 },
    );
  }
  const note = typeof record.note === "string" ? record.note : undefined;

  try {
    const transaction = await reviewCoreTransaction(
      token,
      id,
      action as CoreReviewAction,
      note,
    );
    return NextResponse.json(transaction);
  } catch (error) {
    return renderUpstreamError(
      `POST /api/transactions/${id}/review`,
      error,
      body,
    );
  }
}
