import { NextResponse } from "next/server";
import { createCoreTask, listCoreTasks } from "@/src/lib/coreApi";

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

  const params = new URL(req.url).searchParams;
  const type = params.get("type") || undefined;
  const status = params.get("status") || undefined;

  try {
    const items = await listCoreTasks(token, { type, status });
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list tasks";
    console.error("GET /api/tasks error:", message);
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
    const task = await createCoreTask(token, body as Record<string, unknown>);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create task";
    console.error("POST /api/tasks error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
