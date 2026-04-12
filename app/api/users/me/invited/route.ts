import { NextResponse } from "next/server";
import { verifyToken } from "../../../../../src/lib/verifyToken";
import { pool } from "../../../../../src/lib/db";

type UserColumn = "full_name" | "invited_by" | "created_at";

async function getUserColumns() {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'users'
       AND column_name = ANY($1::text[])`,
    [["full_name", "invited_by", "created_at"]],
  );

  return new Set(result.rows.map((row) => String(row.column_name))) as Set<UserColumn>;
}

function formatDisplayName(email: string) {
  const localPart = (email.split("@")[0] || "user").replace(/[._-]/g, " ");
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

    if (!["SUPER_ADMIN", "ADMIN"].includes(requesterRole)) {
      return NextResponse.json(
        { error: "You are not allowed to view invited users" },
        { status: 403 },
      );
    }

    const userColumns = await getUserColumns();
    const fullNameSelect = userColumns.has("full_name")
      ? "u.full_name"
      : "NULL::text AS full_name";
    const createdAtSelect = userColumns.has("created_at")
      ? "u.created_at"
      : "NULL::timestamp AS created_at";
    const inviterJoin = userColumns.has("invited_by")
      ? "LEFT JOIN users inviter_user ON inviter_user.id = u.invited_by"
      : "";
    const inviterSelect = userColumns.has("invited_by")
      ? "inviter_user.email AS invited_by_email,"
      : "NULL::text AS invited_by_email,";

    const query =
      requesterRole === "SUPER_ADMIN"
        ? `SELECT
             u.id,
             u.email,
             u.role,
             u.status,
             ${fullNameSelect},
             ${createdAtSelect},
             ${inviterSelect}
             o.name AS organization_name
           FROM users u
           LEFT JOIN organizations o ON o.id = u.organization_id
           ${inviterJoin}
           WHERE u.role = 'ADMIN'
           ORDER BY u.id DESC`
        : `SELECT
             u.id,
             u.email,
             u.role,
             u.status,
             ${fullNameSelect},
             ${createdAtSelect},
             ${inviterSelect}
             o.name AS organization_name
           FROM users u
           LEFT JOIN organizations o ON o.id = u.organization_id
           ${inviterJoin}
           WHERE u.organization_id = $1
             AND u.role IN ('ACCOUNTANT', 'CLIENT')
           ORDER BY u.id DESC`;

    const params =
      requesterRole === "SUPER_ADMIN" ? [] : [requester.organization_id];

    const result = await pool.query(query, params);

    const users = result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: String(row.role || "").toLowerCase(),
      status: row.status || "INVITED",
      name: row.full_name || formatDisplayName(String(row.email || "")),
      organizationName: row.organization_name || "",
      invitedByEmail: row.invited_by_email || "",
      createdAt: row.created_at || null,
    }));

    const summary = {
      total: users.length,
      pending: users.filter((user) => user.status === "INVITED").length,
      admins: users.filter((user) => user.role === "admin").length,
      accountants: users.filter((user) => user.role === "accountant").length,
      clients: users.filter((user) => user.role === "client").length,
      organizations:
        requesterRole === "SUPER_ADMIN"
          ? new Set(
              users
                .map((user) => user.organizationName)
                .filter(Boolean),
            ).size
          : requester.organization_id
            ? 1
            : 0,
    };

    return NextResponse.json({
      summary,
      users,
    });
  } catch (error) {
    console.error("Fetch invited users error:", error);
    return NextResponse.json(
      { error: "Failed to fetch invited users" },
      { status: 500 },
    );
  }
}
