import { NextResponse } from "next/server";
import {
  createCoreProperty,
  listCoreProperties,
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
    const items = await listCoreProperties(token, id);
    return NextResponse.json({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list properties";
    console.error(`GET /api/entities/${id}/properties error:`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

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

  try {
    const property = await createCoreProperty(
      token,
      id,
      body as Record<string, unknown>,
    );
    return NextResponse.json(property, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create property";
    console.error(`POST /api/entities/${id}/properties error:`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
