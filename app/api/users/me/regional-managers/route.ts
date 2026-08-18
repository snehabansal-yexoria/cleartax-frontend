import { NextResponse } from "next/server";
import { verifyToken } from "@/src/lib/verifyToken";
import {
  findDirectoryUserByIdentity,
  listDirectoryUsers,
  type VerifiedTokenLike,
} from "@/src/lib/userDirectory";
import { getRoleIdByName } from "@/src/lib/roles";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = (await verifyToken(token)) as VerifiedTokenLike | null;

    if (!decoded?.sub) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    const requester = await findDirectoryUserByIdentity({
      id: decoded.sub,
      email: decoded.email,
    });

    if (!requester) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const requesterRole = requester.role.toLowerCase();

    if (!["admin", "accountant", "client"].includes(requesterRole)) {
      return NextResponse.json(
        { error: "Not authorized to list regional managers" },
        { status: 403 },
      );
    }

    if (!requester.orgId) {
      return NextResponse.json({ regionalManagers: [] });
    }

    const rmRoleId = await getRoleIdByName("regional_manager");

    if (!rmRoleId) {
      return NextResponse.json({ regionalManagers: [] });
    }

    const users = await listDirectoryUsers({
      orgId: requester.orgId,
      roleIds: [rmRoleId],
    });

    return NextResponse.json({
      regionalManagers: users.map((u) => ({
        id: u.id,
        name: u.fullName,
        email: u.email,
        role: "Regional Manager",
      })),
    });
  } catch (error) {
    console.error("Fetch regional managers error:", error);
    return NextResponse.json(
      { error: "Failed to fetch regional managers" },
      { status: 500 },
    );
  }
}
