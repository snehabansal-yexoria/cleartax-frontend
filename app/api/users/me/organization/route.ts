import { NextResponse } from "next/server";
import { verifyToken } from "@/src/lib/verifyToken";
import {
  findDirectoryUserByIdentity,
  getOrganizationById,
} from "@/src/lib/userDirectory";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const idToken = authHeader.split(" ")[1];
    const decoded = await verifyToken(idToken);

    if (!decoded || !decoded.sub) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    const currentUser = await findDirectoryUserByIdentity({
      id: String(decoded.sub || ""),
      email: String(decoded.email || ""),
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!currentUser.orgId) {
      return NextResponse.json({ organization: null });
    }

    const organization = await getOrganizationById(currentUser.orgId);

    return NextResponse.json({
      organization: organization.id
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
