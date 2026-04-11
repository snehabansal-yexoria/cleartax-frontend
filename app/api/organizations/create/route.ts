import { NextResponse } from "next/server";
import { pool } from "@/src/lib/db";
import { verifyToken } from "@/src/lib/verifyToken";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    console.log("DB:", pool);

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
    const { name } = body;

    // 🔥 STEP 1: Get user from DB
    const userResult = await pool.query(
      "SELECT id FROM users WHERE cognito_user_id = $1",
      [decoded.sub],
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: "User not found in DB" },
        { status: 404 },
      );
    }

    const userId = userResult.rows[0].id;

    // 🔥 STEP 2: Create organization
    await pool.query(
      "INSERT INTO organizations (name, created_by) VALUES ($1, $2)",
      [name, userId],
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      {
        error: "Database error",
        details: error.message || error,
      },
      { status: 500 },
    );
  }
}
