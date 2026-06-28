import { NextResponse } from "next/server";
import { coreApiRequest } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";
import { scopeRulesForAccountant } from "@/src/lib/ruleScope";

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });
  try {
    const data = await coreApiRequest("/transaction-rules", { token });
    // Accountants only see rules they created; admins keep full visibility.
    return NextResponse.json(await scopeRulesForAccountant(token, data));
  } catch (error) {
    return renderUpstreamError("GET /api/transaction-rules", error);
  }
}
