import { NextResponse } from "next/server";
import {
  deleteCoreEntity,
  getCoreEntity,
  updateCoreEntity,
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
    const entity = await getCoreEntity(token, id);
    return NextResponse.json(entity);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch entity";
    console.error(`GET /api/entities/${id} error:`, message);
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
    const entity = await updateCoreEntity(token, id, body as Record<string, unknown>);
    return NextResponse.json(entity);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update entity";
    console.error(`PATCH /api/entities/${id} error:`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    await deleteCoreEntity(token, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete entity";
    console.error(`DELETE /api/entities/${id} error:`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
