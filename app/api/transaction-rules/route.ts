import { NextResponse } from "next/server";
import { coreApiRequest } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });
  try {
    const data = await coreApiRequest("/transaction-rules", { token });
    return NextResponse.json(data);
  } catch (error) {
    return renderUpstreamError("GET /api/transaction-rules", error);
  }
}
