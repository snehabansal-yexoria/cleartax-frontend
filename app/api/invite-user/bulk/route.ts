import { NextResponse } from "next/server";
import { getCoreApiBearerFromRequest } from "@/src/lib/coreApi";
import { verifyToken } from "@/src/lib/verifyToken";
import {
  findOrganizationIdByNameOrId,
  inviteUser,
  type InviteVerifiedToken,
} from "@/src/lib/invitations";

type BulkInviteRow = {
  email?: string;
  admin_email?: string;
  role?: string;
  full_name?: string;
  organization?: string;
  organization_id?: string;
  org_name?: string;
};

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = (await verifyToken(token)) as InviteVerifiedToken | null;

    if (!decoded?.sub || !decoded.email) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    const inviterRole = String(decoded["custom:role"] || "")
      .trim()
      .toUpperCase();
    const apiToken = getCoreApiBearerFromRequest(req, "");
    const body = await req.json();
    const rows = Array.isArray(body.rows) ? (body.rows as BulkInviteRow[]) : [];

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "At least one CSV row is required" },
        { status: 400 },
      );
    }

    const results: Array<{
      row: number;
      email: string;
      role: string;
      success: boolean;
      temporaryPassword?: string;
      error?: string;
    }> = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];

      try {
        let organizationId = "";
        let email = "";
        let requestedRole = "";

        if (inviterRole === "SUPER_ADMIN") {
          const organizationValue = String(
            row.organization_id || row.organization || row.org_name || "",
          ).trim();
          email = String(row.admin_email || row.email || "").trim();
          requestedRole = "admin";

          if (!organizationValue || !email) {
            throw new Error("organization and admin_email are required");
          }

          organizationId = await findOrganizationIdByNameOrId(
            apiToken,
            organizationValue,
          );

          if (!organizationId) {
            throw new Error(`Organization not found: ${organizationValue}`);
          }
        } else if (inviterRole === "ADMIN") {
          email = String(row.email || "").trim();
          requestedRole = String(row.role || "")
            .trim()
            .toLowerCase();

          if (!email || !requestedRole) {
            throw new Error("email and role are required");
          }

          if (!["accountant", "client"].includes(requestedRole)) {
            throw new Error("role must be accountant or client");
          }
        } else {
          return NextResponse.json(
            { error: "You are not allowed to bulk invite users" },
            { status: 403 },
          );
        }

        const result = await inviteUser({
          inviter: decoded,
          apiToken,
          email,
          requestedRole,
          organizationId,
          fullName: String(row.full_name || "").trim(),
        });

        results.push({
          row: index + 2,
          email,
          role: requestedRole,
          success: true,
          temporaryPassword: result.temporaryPassword,
        });
      } catch (error) {
        results.push({
          row: index + 2,
          email: String(row.admin_email || row.email || "").trim(),
          role:
            inviterRole === "SUPER_ADMIN"
              ? "admin"
              : String(row.role || "")
                  .trim()
                  .toLowerCase(),
          success: false,
          error: error instanceof Error ? error.message : "Unexpected error",
        });
      }
    }

    return NextResponse.json({
      total: results.length,
      successful: results.filter((result) => result.success).length,
      failed: results.filter((result) => !result.success).length,
      results,
    });
  } catch (error: unknown) {
    console.error("Bulk invite error:", error);
    return NextResponse.json(
      {
        error: "Failed to process bulk upload",
        details:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 },
    );
  }
}
