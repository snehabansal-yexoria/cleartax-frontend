import { NextResponse } from "next/server";
import {
  getCoreApiBearerFromRequest,
} from "@/src/lib/coreApi";
import {
  findApiDirectoryUserByIdentity,
  getApiOrganizationById,
} from "@/src/lib/coreUserDirectory";
import { verifyToken } from "@/src/lib/verifyToken";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const idToken = authHeader.split(" ")[1];
    const decoded = await verifyToken(idToken);
    const apiToken = getCoreApiBearerFromRequest(req, idToken);

    if (!decoded || !decoded.sub) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    const currentUser = await findApiDirectoryUserByIdentity(apiToken, {
      id: String(decoded.sub || ""),
      email: String(decoded.email || ""),
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!currentUser.orgId) {
      return NextResponse.json({ organization: null });
    }

    const organization =
      currentUser.orgName
        ? { id: currentUser.orgId, name: currentUser.orgName }
        : await getApiOrganizationById(apiToken, currentUser.orgId);

    return NextResponse.json({
      organization: organization?.id
        ? { id: organization.id, name: organization.name }
        : null,
    });
  } catch (error) {
    console.error("Fetch organization error:", error);

    return NextResponse.json(
      { error: "Failed to fetch organization" },
      { status: 500 },
    );
  }
}
