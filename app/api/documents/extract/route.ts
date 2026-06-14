import { NextResponse } from "next/server";
import { coreApiRequest } from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type ExtractResponse = {
  success: boolean;
  data: Record<string, unknown>;
  matched_rule?: {
    rule_id: number;
    rule_name: string;
    assigned_type?: string;
    assigned_category_id?: number;
    assigned_subcategory_id?: number;
    auto_confirm?: boolean;
  } | null;
};

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

  try {
    const payload = await coreApiRequest<ExtractResponse>("/api/extract", {
      method: "POST",
      token,
      body,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return renderUpstreamError("POST /api/documents/extract", error, body);
  }
}
