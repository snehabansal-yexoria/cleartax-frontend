import { NextResponse } from "next/server";
import {
  deleteCoreEntity,
  getCoreEntity,
  updateCoreEntity,
} from "@/src/lib/coreApi";
import { pool } from "@/src/lib/db";

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

    // Fetch assigned regional manager directly from database
    const dbRes = await pool.query(
      `SELECT e.assigned_regional_manager_id, u.full_name, u.email 
       FROM entity e
       LEFT JOIN users u ON u.id = e.assigned_regional_manager_id
       WHERE e.id = $1::uuid`,
      [id]
    );

    const dbRow = dbRes.rows[0];
    if (dbRow && dbRow.assigned_regional_manager_id) {
      (entity as any).regionalManager = {
        id: dbRow.assigned_regional_manager_id,
        name: dbRow.full_name,
        email: dbRow.email,
        role: "Regional Manager",
      };
    } else {
      (entity as any).regionalManager = null;
    }

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
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const { assignedRegionalManagerId, ...coreBody } = body || {};

    // Save assigned regional manager to the database if passed
    if (body && typeof body === "object" && "assignedRegionalManagerId" in body) {
      const assignedId = assignedRegionalManagerId
        ? String(assignedRegionalManagerId).trim()
        : null;

      await pool.query(
        `UPDATE entity 
         SET assigned_regional_manager_id = $1 
         WHERE id = $2::uuid`,
        [assignedId || null, id]
      );
    }

    // Only call updateCoreEntity if there are core entity fields to update
    const entity = Object.keys(coreBody).length > 0
      ? await updateCoreEntity(token, id, coreBody as Record<string, unknown>)
      : await getCoreEntity(token, id);

    // Fetch updated regional manager details
    const dbRes = await pool.query(
      `SELECT e.assigned_regional_manager_id, u.full_name, u.email 
       FROM entity e
       LEFT JOIN users u ON u.id = e.assigned_regional_manager_id
       WHERE e.id = $1::uuid`,
      [id]
    );

    const dbRow = dbRes.rows[0];
    if (dbRow && dbRow.assigned_regional_manager_id) {
      (entity as any).regionalManager = {
        id: dbRow.assigned_regional_manager_id,
        name: dbRow.full_name,
        email: dbRow.email,
        role: "Regional Manager",
      };
    } else {
      (entity as any).regionalManager = null;
    }

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
