import { NextResponse } from "next/server";
import { verifyToken } from "@/src/lib/verifyToken";
import { pool } from "@/src/lib/db";

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

    const result = await pool.query(
      `SELECT o.id, o.name
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.cognito_user_id = $1`,
      [decoded.sub],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      organization: result.rows[0].id
        ? {
            id: result.rows[0].id,
            name: result.rows[0].name,
          }
        : null,
    });
  } catch (error) {
    console.error("Fetch organization error:", error);

    return NextResponse.json(
      { error: "Failed to fetch organization" },
      { status: 500 },
    );
  }
}
