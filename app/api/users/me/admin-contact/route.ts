import { NextResponse } from "next/server";
import { verifyToken } from "../../../../../src/lib/verifyToken";
import {
  getCoreApiBearerFromRequest,
} from "../../../../../src/lib/coreApi";
import {
  findApiDirectoryUserByIdentity,
  listApiDirectoryUsers,
} from "../../../../../src/lib/coreUserDirectory";

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
      return NextResponse.json({ adminContact: null });
    }

    const users = await listApiDirectoryUsers(apiToken, {
      orgId: currentUser.orgId,
    });

    const adminContact = users.find(
      (user) =>
        user.role === "admin" &&
        user.orgId &&
        user.orgId === currentUser.orgId &&
        user.email.toLowerCase() !== currentUser.email.toLowerCase(),
    );

    if (!adminContact) {
      return NextResponse.json({ adminContact: null });
    }

    return NextResponse.json({
      adminContact: {
        email: adminContact.email,
        role: adminContact.role,
      },
    });
  } catch (error) {
    console.error("Fetch admin contact error:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin contact" },
      { status: 500 },
    );
  }
}
