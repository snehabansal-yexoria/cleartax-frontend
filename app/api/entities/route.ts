import { NextResponse } from "next/server";
import {
  createCoreEntity,
  listCoreEntities,
} from "@/src/lib/coreApi";

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value;
}

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const clientId = new URL(req.url).searchParams.get("client_id") || undefined;

  try {
    const items = await listCoreEntities(token, { clientId });
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list entities";
    console.error("GET /api/entities error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

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
    const entity = await createCoreEntity(token, body as Record<string, unknown>);
    return NextResponse.json(entity, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create entity";
    console.error("POST /api/entities error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
