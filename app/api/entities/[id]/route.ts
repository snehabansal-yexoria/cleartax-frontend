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
  if (id.startsWith("demo-")) {
    const demoEntities: Record<string, any> = {
      "demo-ent-1": {
        id: "demo-ent-1",
        orgId: "demo-org",
        entityType: "trust",
        name: "Johnson Family Trust",
        createdFor: "demo-user",
        createdBy: "demo-user",
        updatedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        beneficiaries: [
          { id: 1, name: "Sarah Johnson", ownershipPercentage: 100 }
        ],
        reconciled: false,
        reconciledAt: null,
        regionalManager: {
          id: "demo-rm-1",
          name: "Michael Chang",
          email: "michael.chang@cleartax.com.au",
          role: "Regional Manager"
        }
      },
      "demo-ent-2": {
        id: "demo-ent-2",
        orgId: "demo-org",
        entityType: "company",
        name: "SJ Holdings Pvt Ltd",
        createdFor: "demo-user",
        createdBy: "demo-user",
        updatedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        beneficiaries: [
          { id: 1, name: "Sarah Johnson", ownershipPercentage: 50 },
          { id: 2, name: "John Johnson", ownershipPercentage: 50 }
        ],
        reconciled: false,
        reconciledAt: null,
        regionalManager: null
      },
      "demo-ent-3": {
        id: "demo-ent-3",
        orgId: "demo-org",
        entityType: "individual",
        name: "Sarah Johnson",
        createdFor: "demo-user",
        createdBy: "demo-user",
        updatedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        beneficiaries: [],
        reconciled: false,
        reconciledAt: null,
        regionalManager: null
      },
      "demo-entity-1": {
        id: "demo-entity-1",
        orgId: "demo-org",
        entityType: "trust",
        name: "Johnson Family Trust",
        createdFor: "demo-user",
        createdBy: "demo-user",
        updatedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        beneficiaries: [
          { id: 1, name: "Sarah Johnson", ownershipPercentage: 100 }
        ],
        reconciled: false,
        reconciledAt: null,
        regionalManager: {
          id: "demo-rm-1",
          name: "Michael Chang",
          email: "michael.chang@cleartax.com.au",
          role: "Regional Manager"
        }
      },
      "demo-entity-2": {
        id: "demo-entity-2",
        orgId: "demo-org",
        entityType: "company",
        name: "SJ Holdings Pvt Ltd",
        createdFor: "demo-user",
        createdBy: "demo-user",
        updatedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        beneficiaries: [
          { id: 1, name: "Sarah Johnson", ownershipPercentage: 100 }
        ],
        reconciled: false,
        reconciledAt: null,
        regionalManager: null
      }
    };
    const entity = demoEntities[id] || demoEntities["demo-ent-1"];
    return NextResponse.json(entity);
  }

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
  if (id.startsWith("demo-")) {
    return NextResponse.json({
      id,
      name: "Mocked Demo Entity",
      entityType: "trust",
      beneficiaries: [],
      reconciled: false,
      reconciledAt: null,
      regionalManager: null,
    });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    // Save assigned regional manager to the database if passed
    if (body && typeof body === "object" && "assignedRegionalManagerId" in body) {
      const assignedId = body.assignedRegionalManagerId
        ? String(body.assignedRegionalManagerId).trim()
        : null;

      await pool.query(
        `UPDATE entity 
         SET assigned_regional_manager_id = $1 
         WHERE id = $2::uuid`,
        [assignedId || null, id]
      );
    }

    const entity = await updateCoreEntity(token, id, body as Record<string, unknown>);

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
  if (id.startsWith("demo-")) {
    return new NextResponse(null, { status: 204 });
  }
  try {
    await deleteCoreEntity(token, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete entity";
    console.error(`DELETE /api/entities/${id} error:`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
