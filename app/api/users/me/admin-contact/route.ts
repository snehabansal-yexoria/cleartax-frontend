import { NextResponse } from "next/server";
import { verifyToken } from "@/src/lib/verifyToken";
import { getRoleIdByName } from "@/src/lib/roles";
import {
  findDirectoryUserByIdentity,
  listDirectoryUsers,
  type VerifiedTokenLike,
} from "@/src/lib/userDirectory";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = (await verifyToken(token)) as VerifiedTokenLike | null;

    if (!decoded || !decoded.sub) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    const currentUser = await findDirectoryUserByIdentity({
      id: decoded.sub,
      email: decoded.email,
    });

    if (!currentUser || !currentUser.orgId) {
      return NextResponse.json({ adminContact: null });
    }

    const adminRoleId = await getRoleIdByName("admin");

    if (!adminRoleId) {
      return NextResponse.json(
        { error: "Admin role is missing in the database" },
        { status: 500 },
      );
    }

    const adminUsers = await listDirectoryUsers({
      orgId: currentUser.orgId,
      roleIds: [adminRoleId],
    });

    const adminContact = adminUsers.find(
      (user) => user.email.toLowerCase() !== currentUser.email.toLowerCase(),
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
