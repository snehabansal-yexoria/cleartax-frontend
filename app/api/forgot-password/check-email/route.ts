import { NextResponse } from "next/server";
import { pool } from "../../../../src/lib/db";

// Public (pre-auth) endpoint: the forgot-password page checks the app database
// before asking Cognito to email a reset code, so addresses missing from the
// users table get an explicit "email does not exist" error instead of an email
// (Cognito can hold accounts the app database no longer knows about).
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string };
    const email = typeof body.email === "string" ? body.email.trim() : "";

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT 1
       FROM users
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [email],
    );

    return NextResponse.json({ exists: result.rows.length > 0 });
  } catch (error) {
    console.error("Forgot-password email check error:", error);
    return NextResponse.json(
      { error: "Failed to check email" },
      { status: 500 },
    );
  }
}
