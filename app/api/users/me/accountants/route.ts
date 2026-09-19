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

    if (!["admin", "accountant"].includes(requesterRole)) {
      return NextResponse.json(
        { error: "Not authorized to list accountants" },
        { status: 403 },
      );
    }

    if (!requester.orgId) {
      return NextResponse.json({ accountants: [] });
    }

    const accountantRoleId = await getRoleIdByName("accountant");

    if (!accountantRoleId) {
      return NextResponse.json({ accountants: [] });
    }

    const users = await listDirectoryUsers({
      orgId: requester.orgId,
      roleIds: [accountantRoleId],
    });

    return NextResponse.json({
      accountants: users.map((u) => ({
        id: u.id,
        name: u.fullName,
        email: u.email,
      })),
    });
  } catch (error) {
    console.error("Fetch accountants error:", error);
    return NextResponse.json(
      { error: "Failed to fetch accountants" },
      { status: 500 },
    );
  }
}
