import { NextResponse } from "next/server";
import {
  deleteCoreProperty,
  getCoreProperty,
  updateCoreProperty,
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
    const property = await getCoreProperty(token, id);
    return NextResponse.json(property);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch property";
    console.error(`GET /api/properties/${id} error:`, message);
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
    const property = await updateCoreProperty(
      token,
      id,
      body as Record<string, unknown>,
    );
    return NextResponse.json(property);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update property";
    console.error(`PATCH /api/properties/${id} error:`, message);
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
    await deleteCoreProperty(token, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete property";
    console.error(`DELETE /api/properties/${id} error:`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
