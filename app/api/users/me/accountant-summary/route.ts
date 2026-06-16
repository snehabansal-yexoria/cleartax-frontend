import { NextResponse } from "next/server";
import {
  CoreApiError,
  getCoreAccountantSummary,
  getCoreApiBearerFromRequest,
} from "@/src/lib/coreApi";
import { logError } from "@/src/lib/log";

export async function GET(req: Request) {
  try {
    // Single backend call. The core API computes every dashboard stat-card
    // number (org-wide pending count, my registered/managed counts, my property
    // count + market value) as aggregates — no client list fetched.
    const summary = await getCoreAccountantSummary(getCoreApiBearerFromRequest(req));
    return NextResponse.json(summary);
  } catch (error) {
    logError("Accountant summary fetch failed", error, {
      route: "GET /api/users/me/accountant-summary",
    });
    const status = error instanceof CoreApiError ? error.status : 500;
    return NextResponse.json(
      { error: "Failed to fetch summary stats" },
      { status },
    );
  }
}
