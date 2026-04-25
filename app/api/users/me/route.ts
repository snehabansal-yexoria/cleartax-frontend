import { NextResponse } from "next/server";

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

    // Go backend returns snake_case; normalize to the camelCase shape the
    // frontend already consumes (see dashboard/layout.tsx, LoginComponent).
    return NextResponse.json({
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      role: data.role_name || "unknown",
      roleId: data.role_id ?? null,
      orgId: data.org_id || "",
      orgName: data.org_name || "",
      status: data.status || "",
    });
  } catch (error) {
    console.error("Proxy /users/me error:", error);
    return NextResponse.json(
      { error: "Failed to fetch current user" },
      { status: 500 },
    );
  }
}
