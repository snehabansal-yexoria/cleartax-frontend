import { NextResponse } from "next/server";
import { verifyToken } from "../../../../src/lib/verifyToken";
import {
  getCoreApiBearerFromRequest,
  listCoreUsers,
  updateCoreUser,
} from "../../../../src/lib/coreApi";
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
    const apiToken = getCoreApiBearerFromRequest(req, token);

    if (!decoded?.email) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    const users = await listCoreUsers(apiToken).catch(() => []);
    const currentUser = users.find(
      (user) => user.email.toLowerCase() === decoded.email?.toLowerCase(),
    );

    if (currentUser?.id) {
      await updateCoreUser(apiToken, currentUser.id, {
        is_active: true,
      }).catch(() => null);
    }

    await pool
      .query(
        `UPDATE user_invitation
         SET status = 'accepted',
             accepted_at = COALESCE(accepted_at, CURRENT_TIMESTAMP)
         WHERE lower(email) = lower($1)
           AND accepted_at IS NULL`,
        [decoded.email],
      )
      .catch(() => null);

    return NextResponse.json({
      success: true,
      updated: currentUser?.id ? 1 : 0,
    });
  } catch (error) {
    console.error("Accept invitation error:", error);
    return NextResponse.json(
      { error: "Failed to mark invitation as accepted" },
      { status: 500 },
    );
  }
}
