import { NextResponse } from "next/server";
import {
  coreApiRequest,
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

    // The caller's own org, straight from GET /users/me (looked up by the
    // token's email). The directory search below lists GET /users, which the
    // backend caps at 50 rows, so in a firm with more users the caller could
    // be missing from it and this route answered "User not found".
    const me = await readOwnOrganization(apiToken);
    if (me) {
      return NextResponse.json({ organization: me });
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

async function readOwnOrganization(
  token: string,
): Promise<{ id: string; name: string } | null> {
  try {
    const me = (await coreApiRequest("/users/me", { token })) as {
      org_id?: string | null;
      org_name?: string | null;
    } | null;
    const id = typeof me?.org_id === "string" ? me.org_id : "";
    if (!id) return null;
    return { id, name: typeof me?.org_name === "string" ? me.org_name : "" };
  } catch (error) {
    // Fall back to the directory lookup rather than failing the page.
    console.error("GET /users/me for organization failed:", error);
    return null;
  }
}
