import { NextResponse } from "next/server";
import { normalizeRoleName } from "@/src/lib/roleNames";
import {
  findDirectoryUserByIdentity,
  type VerifiedTokenLike,
} from "@/src/lib/userDirectory";
import { verifyToken } from "@/src/lib/verifyToken";
import { pool } from "@/src/lib/db";

function getBackendUrl() {
  const base =
    process.env.CORE_API_BASE_URL || process.env.NEXT_PUBLIC_CORE_API_BASE_URL;
  if (!base) throw new Error("CORE_API_BASE_URL is not configured");
  return base.replace(/\/+$/, "");
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1] || "";

    const upstream = await fetch(`${getBackendUrl()}/users/me`, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const body = await upstream.text();
    const data = body ? JSON.parse(body) : null;

    if (!upstream.ok) {
      return NextResponse.json(data ?? { error: upstream.statusText }, {
        status: upstream.status,
      });
    }

    const decoded = token
      ? ((await verifyToken(token)) as VerifiedTokenLike | null)
      : null;
    const directoryUser = await findDirectoryUserByIdentity({
      id: decoded?.sub || data?.id,
      email: decoded?.email || data?.email,
    });
    const role = normalizeRoleName(
      data.role_name || data.role || directoryUser?.role,
    );

    // Go backend returns snake_case; normalize to the camelCase shape the
    // frontend already consumes (see dashboard/layout.tsx, LoginComponent).
    return NextResponse.json({
      id: data.id || directoryUser?.id || decoded?.sub || "",
      email: data.email || directoryUser?.email || decoded?.email || "",
      fullName:
        data.full_name ||
        data.fullName ||
        directoryUser?.fullName ||
        decoded?.name ||
        "",
      role,
      roleId: data.role_id ?? directoryUser?.roleId ?? null,
      orgId: data.org_id || data.orgId || directoryUser?.orgId || "",
      orgName: data.org_name || data.orgName || directoryUser?.orgName || "",
      status: data.status || directoryUser?.status || "",
      phoneNumber:
        data.phone_number ||
        data.phone ||
        data.phoneNumber ||
        directoryUser?.phoneNumber ||
        "",
    });
  } catch (error) {
    console.error("Proxy /users/me error:", error);
    return NextResponse.json(
      { error: "Failed to fetch current user" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1] || "";
    const decoded = token
      ? ((await verifyToken(token)) as VerifiedTokenLike | null)
      : null;

    if (!decoded || (!decoded.sub && !decoded.email)) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    // 1. Fetch current user from Go backend to get the exact database user ID
    const meRes = await fetch(`${getBackendUrl()}/users/me`, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    let userId = "";
    if (meRes.ok) {
      const meBody = await meRes.text();
      const meData = meBody ? JSON.parse(meBody) : null;
      userId = meData?.id || "";
    }

    // Fallback: search by email/sub in local database directory
    if (!userId) {
      const directoryUser = await findDirectoryUserByIdentity({
        id: decoded.sub,
        email: decoded.email,
      });
      userId = directoryUser?.id || "";
    }

    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { phoneNumber, fullName } = body;

    // 2. Build the request body for the backend update
    const updateBody: Record<string, unknown> = {};
    if (phoneNumber !== undefined) {
      updateBody.phone_number = phoneNumber;
      updateBody.phone = phoneNumber;
    }
    if (fullName !== undefined) {
      updateBody.full_name = fullName;
    }

    // 3. Call Go backend PATCH /users/{id} to update in Cognito/backend database
    const res = await fetch(
      `${getBackendUrl()}/users/${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(updateBody),
        cache: "no-store",
      },
    );

    const responseText = await res.text();
    const responseData = responseText ? JSON.parse(responseText) : null;

    if (!res.ok) {
      return NextResponse.json(
        responseData ?? { error: res.statusText },
        { status: res.status },
      );
    }

    // 4. Sync the updated full_name with local Postgres database to avoid inconsistencies
    if (fullName) {
      await pool
        .query(
          `UPDATE users
         SET full_name = $1
         WHERE id = $2 OR lower(email) = $3`,
          [fullName, userId, (decoded.email || "").toLowerCase()],
        )
        .catch((err) => {
          console.error("Failed to sync updated full name to PG db:", err);
        });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: responseData?.id || userId,
        email: responseData?.email || decoded.email || "",
        fullName: responseData?.full_name || responseData?.fullName || fullName || "",
        phoneNumber: responseData?.phone_number || responseData?.phone || responseData?.phoneNumber || phoneNumber || "",
      },
    });
  } catch (error) {
    console.error("Proxy PATCH /users/me error:", error);
    return NextResponse.json(
      { error: "Failed to update user profile" },
      { status: 500 },
    );
  }
}

