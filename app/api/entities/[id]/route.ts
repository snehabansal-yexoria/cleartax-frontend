import { NextResponse } from "next/server";
import {
  deleteCoreEntity,
  getCoreEntity,
  updateCoreEntity,
  type CoreEntity,
  type CoreRegionalManager,
} from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";
import { pool } from "@/src/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

type RegionalManagerRow = {
  assigned_regional_manager_id: string | null;
  full_name: string | null;
  email: string | null;
};

// The regional-manager assignment lives on the entity row but is served from
// the frontend's direct DB connection (see API_BACKEND_FIXES_HANDOFF.md), so
// the BFF grafts it onto the core entity here.
async function loadRegionalManager(
  entityId: string,
): Promise<CoreRegionalManager | null> {
  const dbRes = await pool.query<RegionalManagerRow>(
    `SELECT e.assigned_regional_manager_id, u.full_name, u.email
       FROM entity e
       LEFT JOIN users u ON u.id = e.assigned_regional_manager_id
      WHERE e.id = $1::uuid`,
    [entityId],
  );
  const row = dbRes.rows[0];
  if (!row || !row.assigned_regional_manager_id) return null;
  return {
    id: row.assigned_regional_manager_id,
    name: row.full_name ?? "",
    email: row.email ?? "",
    role: "Regional Manager",
  };
}

function withRegionalManager(
  entity: CoreEntity,
  regionalManager: CoreRegionalManager | null,
): CoreEntity {
  return { ...entity, regionalManager };
}

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    // Core API and Postgres in parallel: they are independent, and this route
    // gates the entity page's header.
    const [entity, regionalManager] = await Promise.all([
      getCoreEntity(token, id),
      loadRegionalManager(id),
    ]);
    return NextResponse.json(withRegionalManager(entity, regionalManager));
  } catch (error) {
    return renderUpstreamError(`GET /api/entities/${id}`, error);
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
    const record: Record<string, unknown> =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const { assignedRegionalManagerId, ...coreBody } = record;

    // Save assigned regional manager to the database if passed. This write
    // bypasses the core API, so it must enforce the disabled gate itself.
    if ("assignedRegionalManagerId" in record) {
      const enabledRes = await pool.query<{ enabled: boolean | null }>(
        `SELECT enabled FROM entity WHERE id = $1::uuid AND is_deleted = false`,
        [id],
      );
      if (enabledRes.rows[0] && enabledRes.rows[0].enabled === false) {
        return NextResponse.json(
          { code: "entity_disabled", message: "Entity is disabled; re-enable it to make changes" },
          { status: 409 },
        );
      }

      const assignedId = assignedRegionalManagerId
        ? String(assignedRegionalManagerId).trim()
        : null;

      await pool.query(
        `UPDATE entity
            SET assigned_regional_manager_id = $1
          WHERE id = $2::uuid`,
        [assignedId || null, id],
      );
    }

    // Only call updateCoreEntity if there are core entity fields to update
    const entity =
      Object.keys(coreBody).length > 0
        ? await updateCoreEntity(token, id, coreBody)
        : await getCoreEntity(token, id);

    // Fetch updated regional manager details
    const regionalManager = await loadRegionalManager(id);
    return NextResponse.json(withRegionalManager(entity, regionalManager));
  } catch (error) {
    return renderUpstreamError(`PATCH /api/entities/${id}`, error, body);
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
    return renderUpstreamError(`DELETE /api/entities/${id}`, error);
  }
}
