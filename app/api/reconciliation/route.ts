import { NextResponse } from "next/server";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";
import { startReconciliation } from "@/src/lib/coreApi";

export async function POST(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  let body: { s3_key?: string; entity_id?: string; session_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.s3_key || !body.entity_id || !body.session_id) {
    return NextResponse.json(
      { error: "s3_key, entity_id, and session_id are required" },
      { status: 400 },
    );
  }

  try {
    const result = await startReconciliation(
      token,
      body.s3_key,
      body.entity_id,
      body.session_id,
    );
    return NextResponse.json(result);
  } catch (error) {
    return renderUpstreamError("POST /api/reconciliation", error, body);
  }
}
