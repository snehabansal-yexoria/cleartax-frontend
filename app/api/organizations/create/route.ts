import { NextResponse } from "next/server";
import { verifyToken } from "../../../../src/lib/verifyToken";
import {
  createCoreOrganization,
  getCoreApiBearerFromRequest,
} from "../../../../src/lib/coreApi";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const idToken = authHeader.split(" ")[1];
    const decoded = await verifyToken(idToken);

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

    const organization = await createCoreOrganization(accessToken, {
      org_name: orgName,
      org_email: orgEmail,
      tenant_code: tenantCode,
      contact_number: contactNumber,
      address_line1: addressLine1,
      city,
      state,
      country,
      postal_code: postalCode,
      subscription_plan: subscriptionPlan,
      max_users_allowed: maxUsersAllowed,
    });

    return NextResponse.json({
      success: true,
      organization,
    });
  } catch (error: unknown) {
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
    const accessToken = getCoreApiBearerFromRequest(req, idToken);
