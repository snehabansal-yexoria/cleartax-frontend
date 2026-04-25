import { NextResponse } from "next/server";
import { verifyToken } from "../../../../../../src/lib/verifyToken";
import {
  findDirectoryUserByIdentity,
  listDirectoryUsers,
} from "../../../../../../src/lib/userDirectory";

export async function GET(
  req: Request,
  context: { params: Promise<{ clientId: string }> },
) {
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

    const requester = await findDirectoryUserByIdentity({
      id: String(decoded.sub || ""),
      email: String(decoded.email || ""),
    });

    if (!requester) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const requesterRole = String(requester.role || "").toUpperCase();

    if (!["ADMIN", "ACCOUNTANT"].includes(requesterRole)) {
      return NextResponse.json(
        { error: "You are not allowed to view clients" },
        { status: 403 },
      );
    }

    if (!requester.orgId) {
      return NextResponse.json({ error: "Organization missing" }, { status: 400 });
    }

    const params = await context.params;
    const clientId = String(params.clientId || "").trim();

    if (!clientId) {
      return NextResponse.json({ error: "Client id is required" }, { status: 400 });
    }

    const users = await listDirectoryUsers({
      orgId: requester.orgId,
    });

    const client = users.find(
      (user) => user.id === clientId && user.role === "client",
    );

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json({
      client: {
        id: client.id,
        email: client.email,
        status: client.status,
        name: client.fullName,
        phoneNumber: client.phoneNumber || "",
        invitedByEmail: client.invitedByEmail || "",
        joinedAt: client.createdAt,
        assignedAccountantId: client.assignedAccountantId || "",
        assignedAccountantName: client.assignedAccountantName || "",
      },
    });
  } catch (error) {
    console.error("Fetch client detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch client details" },
      { status: 500 },
    );
  }
}
