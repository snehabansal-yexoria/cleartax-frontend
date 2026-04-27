import { NextResponse } from "next/server";
import {
  createCoreUser,
  getCoreApiBearerFromRequest,
  getCoreRoleId,
  listCoreOrganizations,
  listCoreUsers,
  updateCoreUser,
} from "@/src/lib/coreApi";
import { verifyToken } from "@/src/lib/verifyToken";

type ProvisionBody = {
  accessToken?: string;
  tenantCode?: string;
  fullName?: string;
  organizationId?: string;
};

type ProvisionToken = {
  sub?: string;
  email?: string;
  name?: string;
  "custom:role"?: string;
  "custom:tenant_code"?: string;
};

function getDisplayName(email: string) {
  return (email.split("@")[0] || "user")
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const idToken = authHeader.split(" ")[1];
    const decoded = (await verifyToken(idToken)) as ProvisionToken | null;

    if (!decoded?.email) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as ProvisionBody;
    const accessToken =
      String(body.accessToken || "").trim() ||
      getCoreApiBearerFromRequest(req, "");

    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing access token for backend API provisioning" },
        { status: 400 },
      );
    }

    const role = String(decoded["custom:role"] || "").trim().toLowerCase();

    if (!role) {
      return NextResponse.json(
        { error: "Role is missing from the Cognito token" },
        { status: 400 },
      );
    }

    if (role === "super_admin") {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "super_admin does not require organization provisioning",
      });
    }

    const existingUsers = await listCoreUsers(accessToken).catch(() => []);
    const existingUser = existingUsers.find(
      (user) => user.email.toLowerCase() === decoded.email?.toLowerCase(),
    );

    if (existingUser?.id) {
      await updateCoreUser(accessToken, existingUser.id, {
        is_active: true,
      }).catch(() => null);

      await updateCoreUser(accessToken, existingUser.id, {
        status: "accepted",
      }).catch(() => null);

      return NextResponse.json({
        success: true,
        created: false,
        existing: true,
        user: existingUser,
      });
    }

    const roleId = getCoreRoleId(role);

    if (!roleId) {
      return NextResponse.json(
        { error: `No backend role mapping found for ${role}` },
        { status: 400 },
      );
    }

    let organizationId = String(body.organizationId || "").trim();

    if (!organizationId) {
      const tenantCode = String(
        body.tenantCode || decoded["custom:tenant_code"] || "",
      )
        .trim()
        .toUpperCase();

      if (!tenantCode) {
        return NextResponse.json({
          success: true,
          created: false,
          skipped: true,
          reason:
            "No tenant code was present on the token; existing invited users are resolved from the backend user directory.",
        });
      }

      const organizations = await listCoreOrganizations(accessToken);
      const organization = organizations.find(
        (item) => item.tenantCode.trim().toUpperCase() === tenantCode,
      );

      if (!organization?.id) {
        return NextResponse.json(
          { error: `No organization found for tenant code ${tenantCode}` },
          { status: 404 },
        );
      }

      organizationId = organization.id;
    }

    const fullName =
      String(body.fullName || decoded.name || "").trim() ||
      getDisplayName(decoded.email);

    try {
      const user = await createCoreUser(accessToken, {
        email: decoded.email,
        full_name: fullName,
        role_id: roleId,
        org_id: organizationId,
      });

      return NextResponse.json({
        success: true,
        created: true,
        user,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.toLowerCase().includes("409")) {
        return NextResponse.json({
          success: true,
          created: false,
          existing: true,
        });
      }

      throw error;
    }
  } catch (error) {
    console.error("User provisioning error:", error);
    return NextResponse.json(
      {
        error: "Failed to provision user",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
