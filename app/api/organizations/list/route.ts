import { NextResponse } from "next/server";
import { verifyToken } from "../../../../src/lib/verifyToken";
import { pool } from "../../../../src/lib/db";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    await verifyToken(token);

    const result = await pool.query(
      `SELECT
         id,
         org_name,
         org_email,
         tenant_code,
         contact_number,
         address_line1,
         address_line2,
         city,
         state,
         country,
         postal_code,
         subscription_plan,
         max_users_allowed,
         is_active,
         is_verified,
         created_at,
         updated_at
       FROM organisation
       ORDER BY created_at DESC`,
    );

    return NextResponse.json({
      organizations: result.rows.map((organization) => ({
        id: organization.id,
        name: organization.org_name,
        org_name: organization.org_name,
        org_email: organization.org_email,
        tenant_code: organization.tenant_code,
        contact_number: organization.contact_number,
        address_line1: organization.address_line1,
        address_line2: organization.address_line2,
        city: organization.city,
        state: organization.state,
        country: organization.country,
        postal_code: organization.postal_code,
        subscription_plan: organization.subscription_plan,
        max_users_allowed: organization.max_users_allowed,
        is_active: organization.is_active,
        is_verified: organization.is_verified,
        created_at: organization.created_at,
        updated_at: organization.updated_at,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 },
    );
  }
}
