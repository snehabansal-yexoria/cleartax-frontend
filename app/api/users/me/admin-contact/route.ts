import { NextResponse } from "next/server";
import { verifyToken } from "../../../../../src/lib/verifyToken";
import { pool } from "../../../../../src/lib/db";

async function hasInvitedByColumn() {
  const result = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_name = 'users' AND column_name = 'invited_by'
     LIMIT 1`,
  );

  return result.rows.length > 0;
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

    const supportsInvitedBy = await hasInvitedByColumn();

    const query = supportsInvitedBy
      ? `SELECT
           inviter.email,
           inviter.role,
           inviter.id
         FROM users u
         LEFT JOIN users inviter ON inviter.id = u.invited_by
         WHERE u.cognito_user_id = $1
         LIMIT 1`
      : `SELECT
           admin_user.email,
           admin_user.role,
           admin_user.id
         FROM users u
         LEFT JOIN users admin_user
           ON admin_user.organization_id = u.organization_id
          AND admin_user.role = 'ADMIN'
         WHERE u.cognito_user_id = $1
         ORDER BY admin_user.id ASC
         LIMIT 1`;

    const result = await pool.query(query, [decoded.sub]);

    if (result.rows.length === 0) {
      return NextResponse.json({ adminContact: null });
    }

    const adminContact = result.rows[0];

    if (!adminContact?.email) {
      return NextResponse.json({ adminContact: null });
    }

    return NextResponse.json({
      adminContact: {
        email: adminContact.email,
        role: adminContact.role,
      },
    });
  } catch (error) {
    console.error("Fetch admin contact error:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin contact" },
      { status: 500 },
    );
  }
}
