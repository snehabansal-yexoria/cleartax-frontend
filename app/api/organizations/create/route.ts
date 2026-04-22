import { NextResponse } from "next/server";
import { verifyToken } from "../../../../src/lib/verifyToken";
import { pool } from "../../../../src/lib/db";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await verifyToken(token);

    if (!decoded || !decoded.sub) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }
    const body = await req.json();
    const orgName = String(body.name || body.org_name || "").trim();
    const orgEmail = String(body.org_email || "").trim();
    const tenantCode = String(body.tenant_code || "")
      .trim()
      .toUpperCase();
    const addressLine1 = String(body.address_line1 || "").trim();
    const city = String(body.city || "").trim();
    const state = String(body.state || "").trim();
    const country = String(body.country || "AU").trim();
    const postalCode = String(body.postal_code || "").trim();
    const subscriptionPlan = String(body.subscription_plan || "free").trim();
    const maxUsersAllowed = Number(body.max_users_allowed) || 5;
    const contactNumber = String(body.contact_number || "").trim();

    if (!orgName) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 },
      );
    }

    if (!orgEmail || !tenantCode || !addressLine1 || !city || !state || !country || !postalCode) {
      return NextResponse.json(
        {
          error:
            "org_email, tenant_code, address_line1, city, state, country and postal_code are required",
        },
        { status: 400 },
      );
    }

    const creatorEmail = typeof decoded.email === "string" ? decoded.email : "";
    let createdBy: string | null = null;

    if (creatorEmail) {
      const creatorResult = await pool.query(
        `SELECT id
         FROM users
         WHERE lower(email) = lower($1)
         LIMIT 1`,
        [creatorEmail],
      );

      createdBy = creatorResult.rows[0]?.id ?? null;
    }

    const organizationResult = await pool.query(
      `INSERT INTO organisation (
         org_name,
         org_email,
         tenant_code,
         contact_number,
         address_line1,
         city,
         state,
         country,
         postal_code,
         subscription_plan,
         max_users_allowed,
         created_by,
         updated_by
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12
       )
       RETURNING
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
         updated_at`,
      [
        orgName,
        orgEmail,
        tenantCode,
        contactNumber || null,
        addressLine1,
        city,
        state,
        country,
        postalCode,
        subscriptionPlan,
        maxUsersAllowed,
        createdBy,
      ],
    );

    const organization = organizationResult.rows[0];

    return NextResponse.json({
      success: true,
      organization: {
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
      },
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return NextResponse.json(
        { error: "Organization name, email, or tenant code already exists" },
        { status: 409 },
      );
    }

    console.error(error);
    return NextResponse.json(
      {
        error: "Database error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
