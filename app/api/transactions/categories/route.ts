import { NextResponse } from "next/server";
import {
  listCoreTransactionCategories,
  type CoreTransactionType,
} from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";
import { TRANSACTION_TYPES } from "@/src/lib/transactionTypes";

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const url = new URL(req.url);
  const rawType = url.searchParams.get("type");
  // Checked against the shared vocabulary rather than a hand-written list of
  // literals. The list here used to be its own copy, so a type added anywhere
  // else fell through to `undefined` — which does not error, it just returns
  // every category and silently ignores the filter.
  const type: CoreTransactionType | undefined = TRANSACTION_TYPES.includes(
    rawType as CoreTransactionType,
  )
    ? (rawType as CoreTransactionType)
    : undefined;

  try {
    const items = await listCoreTransactionCategories(token, type);
    return NextResponse.json({ items });
  } catch (error) {
    return renderUpstreamError(`GET /api/transactions/categories`, error);
  }
}
