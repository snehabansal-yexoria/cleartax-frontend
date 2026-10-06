import { NextResponse } from "next/server";
import { deleteCoreTask, updateCoreTask } from "@/src/lib/coreApi";
import { pool } from "@/src/lib/db";

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value;
}

type RouteContext = { params: Promise<{ id: string }> };

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

  const requestBody = body as Record<string, unknown>;
  const assigneeId = (requestBody.assigned_to || requestBody.assignedTo) as string | undefined;

  if (typeof assigneeId === "string" && assigneeId.trim()) {
    try {
      await pool.query("UPDATE task SET assigned_to = $1 WHERE id = $2", [
        assigneeId.trim(),
        id,
      ]);
    } catch (dbErr) {
      console.error(`DB Update assigned_to for task ${id} error:`, dbErr);
    }
  }

  try {
    const task = await updateCoreTask(token, id, requestBody);
    return NextResponse.json(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update task";
    console.error(`PATCH /api/tasks/${id} error:`, message);
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
    await deleteCoreTask(token, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete task";
    console.error(`DELETE /api/tasks/${id} error:`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
