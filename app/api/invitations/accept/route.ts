import { NextResponse } from "next/server";
import { verifyToken } from "../../../../src/lib/verifyToken";
import {
  getCoreApiBearerFromRequest,
  listCoreUsers,
  sendWelcomeEmail,
  updateCoreUser,
} from "../../../../src/lib/coreApi";
import { getRequestToken } from "../../../../src/lib/coreApiProxy";
import { pool } from "../../../../src/lib/db";
import { APP_BASE_URL } from "../../../../src/lib/appConfig";

type VerifiedToken = {
  sub?: string;
  email?: string;
};

// Mirrors getDashboardPath in app/components/LoginComponent.tsx
// (note: super_admin maps to the hyphenated "super-admin" segment).
function dashboardSegmentForRole(role: string) {
  if (role === "super_admin") return "super-admin";
  if (role === "admin") return "admin";
  if (role === "accountant") return "accountant";
  return "client";
}

export async function POST(req: Request) {
  try {
    const token = getRequestToken(req);

    if (!token) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

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

    // The welcome email is sent only on the password-set step, which passes
    // { welcome: true }. Ordinary logins / dashboard mounts omit it.
    const body = (await req.json().catch(() => ({}))) as { welcome?: boolean };

    if (body.welcome === true) {
      const segment = dashboardSegmentForRole(currentUser?.role || "client");
      const dashboardLink = `${APP_BASE_URL}/dashboard/${segment}`;

      await sendWelcomeEmail(apiToken, {
        email: String(decoded.email),
        dashboard_link: dashboardLink,
      }).catch((welcomeErr) => {
        console.error("welcome email failed (non-fatal):", welcomeErr);
      });
    }

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
