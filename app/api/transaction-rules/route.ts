import { NextResponse } from "next/server";
import {
  coreApiRequest,
  normalizeCoreTransactionRuleList,
} from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";
import { scopeRulesForAccountant } from "@/src/lib/ruleScope";

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });
  try {
    const data = await coreApiRequest("/transaction-rules", { token });
    // Accountants only see rules they created (filters on the raw snake_case
    // `created_by`), so scope first, then normalize the payload to camelCase.
    const scoped = await scopeRulesForAccountant(token, data);
    return NextResponse.json(normalizeCoreTransactionRuleList(scoped));
  } catch (error) {
    return renderUpstreamError("GET /api/transaction-rules", error);
  }
}
