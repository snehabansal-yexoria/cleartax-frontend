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
        { error: "You are not allowed to view clients" },
        { status: 403 },
      );
    }

    if (!requester.orgId) {
      return NextResponse.json({ clients: [] });
    }

    const scope = new URL(req.url).searchParams.get("scope") === "mine"
      ? "mine"
      : "all";
    const clientRoleId = await getRoleIdByName("client");

    if (!clientRoleId) {
      return NextResponse.json(
        { error: "Client role is missing in the database" },
        { status: 500 },
      );
    }

    const clients = await listDirectoryUsers({
      orgId: requester.orgId,
      roleIds: [clientRoleId],
    });

    return NextResponse.json({
      clients: clients
        .filter(
          (user) =>
            scope !== "mine" || !user.invitedBy || user.invitedBy === requester.id,
        )
        .map((user) => ({
          id: user.id,
          email: user.email,
          status: user.status,
          name: user.fullName,
          phoneNumber: user.phoneNumber || "",
          invitedByEmail: user.invitedByEmail || "",
          joinedAt: user.createdAt,
        })),
    });
  } catch (error) {
    console.error("Fetch clients error:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 },
    );
  }
}
