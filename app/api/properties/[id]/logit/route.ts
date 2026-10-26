import { NextResponse } from "next/server";
import {
  getCorePropertyLogit,
  updateCorePropertyLogit,
} from "@/src/lib/coreApi";

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const data = await getCorePropertyLogit(token, id);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch logit data";
    console.error(`GET /api/properties/${id}/logit error:`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
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

  try {
    const data = await updateCorePropertyLogit(
      token,
      id,
      body as Record<string, unknown>,
    );
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update logit data";
    console.error(`PATCH /api/properties/${id}/logit error:`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
