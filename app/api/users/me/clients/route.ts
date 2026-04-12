import { NextResponse } from "next/server";
import { verifyToken } from "../../../../../src/lib/verifyToken";
import { pool } from "../../../../../src/lib/db";

type UserColumn = "invited_by" | "full_name" | "phone_number" | "created_at";

async function getUserColumns() {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'users'
       AND column_name = ANY($1::text[])`,
    [["invited_by", "full_name", "phone_number", "created_at"]],
  );

  return new Set(result.rows.map((row) => String(row.column_name))) as Set<UserColumn>;
}

function formatDisplayName(email: string) {
  const localPart = (email.split("@")[0] || "client").replace(/[._-]/g, " ");
  return localPart.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function GET(req: Request) {
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

    const requesterResult = await pool.query(
      "SELECT id, role, organization_id FROM users WHERE cognito_user_id = $1",
      [decoded.sub],
    );

    if (requesterResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const requester = requesterResult.rows[0];
    const requesterRole = String(requester.role || "").toUpperCase();

    if (!["ADMIN", "ACCOUNTANT"].includes(requesterRole)) {
      return NextResponse.json(
        { error: "You are not allowed to view clients" },
        { status: 403 },
      );
    }

    if (!requester.organization_id) {
      return NextResponse.json({ clients: [] });
    }

    const scope = new URL(req.url).searchParams.get("scope") === "mine"
      ? "mine"
      : "all";

    const userColumns = await getUserColumns();
    const fullNameSelect = userColumns.has("full_name")
      ? "client_user.full_name"
      : "NULL::text AS full_name";
    const phoneSelect = userColumns.has("phone_number")
      ? "client_user.phone_number"
      : "NULL::text AS phone_number";
    const invitedByJoin = userColumns.has("invited_by")
      ? "LEFT JOIN users inviter_user ON inviter_user.id = client_user.invited_by"
      : "";
    const inviterWhere =
      scope === "mine" && userColumns.has("invited_by")
        ? "AND client_user.invited_by = $2"
        : "";
    const createdAtSelect = userColumns.has("created_at")
      ? "client_user.created_at"
      : "NULL::timestamp AS created_at";
    const params =
      scope === "mine" && userColumns.has("invited_by")
        ? [requester.organization_id, requester.id]
        : [requester.organization_id];

    const result = await pool.query(
      `SELECT
         client_user.id,
         client_user.email,
         client_user.status,
         ${fullNameSelect},
         ${phoneSelect},
         ${createdAtSelect},
         ${
           userColumns.has("invited_by")
             ? "inviter_user.email AS invited_by_email,"
             : "NULL::text AS invited_by_email,"
         }
         client_user.organization_id
       FROM users client_user
       ${invitedByJoin}
       WHERE client_user.role = 'CLIENT'
         AND client_user.organization_id = $1
         ${inviterWhere}
       ORDER BY client_user.id DESC`,
      params,
    );

    return NextResponse.json({
      clients: result.rows.map((row) => ({
        id: row.id,
        email: row.email,
        status: row.status,
        name: row.full_name || formatDisplayName(String(row.email || "")),
        phoneNumber: row.phone_number || "",
        invitedByEmail: row.invited_by_email || "",
        joinedAt: row.created_at || null,
      })),
    });
  } catch (error) {
    console.error("Fetch clients error:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 },
    );
  }
}
