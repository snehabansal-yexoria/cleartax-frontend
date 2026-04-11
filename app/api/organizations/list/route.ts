import { NextResponse } from "next/server";
import { pool } from "@/src/lib/db";
import { verifyToken } from "@/src/lib/verifyToken";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await verifyToken(token);

    // (optional) check role later

    const result = await pool.query(
      "SELECT id, name FROM organizations ORDER BY created_at DESC",
    );

    return NextResponse.json({
      organizations: result.rows,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 },
    );
  }
}
