import { NextResponse } from "next/server";
import { verifyToken } from "../../../../src/lib/verifyToken";
import { pool } from "../../../../src/lib/db";

type VerifiedToken = {
  sub?: string;
  email?: string;
};

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = (await verifyToken(token)) as VerifiedToken | null;

    if (!decoded?.email) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    const result = await pool.query(
      `UPDATE user_invitation
       SET status = 'accepted',
           accepted_at = COALESCE(accepted_at, CURRENT_TIMESTAMP)
       WHERE lower(email) = lower($1)
         AND accepted_at IS NULL
       RETURNING id`,
      [decoded.email],
    );

    return NextResponse.json({
      success: true,
      updated: result.rowCount || 0,
    });
  } catch (error) {
    console.error("Accept invitation error:", error);
    return NextResponse.json(
      { error: "Failed to mark invitation as accepted" },
      { status: 500 },
    );
  }
}
