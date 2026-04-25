import { NextResponse } from "next/server";
import { getCoreApiBearerFromRequest } from "@/src/lib/coreApi";
import { verifyToken } from "@/src/lib/verifyToken";
import { inviteUser, type InviteVerifiedToken } from "@/src/lib/invitations";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = (await verifyToken(token)) as InviteVerifiedToken | null;

    if (!decoded?.sub || !decoded.email) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    const apiToken = getCoreApiBearerFromRequest(req, "");
    const body = await req.json();

    const result = await inviteUser({
      inviter: decoded,
      apiToken,
      email: String(body.email || ""),
      requestedRole: String(body.role || ""),
      organizationId: String(body.organization_id || ""),
      fullName: String(body.full_name || ""),
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Invite error:", error);

    const details =
      error instanceof Error ? error.message : "Unexpected server error";
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof error.status === "number"
        ? error.status
        : 500;

    return NextResponse.json(
      {
        error: status === 500 ? "Database error" : details,
        details,
      },
      { status },
    );
  }
}
