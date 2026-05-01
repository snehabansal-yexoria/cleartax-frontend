import { NextResponse } from "next/server";
import { normalizeRoleName } from "@/src/lib/roleNames";
import {
  findDirectoryUserByIdentity,
  type VerifiedTokenLike,
} from "@/src/lib/userDirectory";
import { verifyToken } from "@/src/lib/verifyToken";

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
    });
  } catch (error) {
    console.error("Proxy /users/me error:", error);
    return NextResponse.json(
      { error: "Failed to fetch current user" },
      { status: 500 },
    );
  }
}
