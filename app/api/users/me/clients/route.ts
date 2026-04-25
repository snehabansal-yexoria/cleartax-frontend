import { NextResponse } from "next/server";
import { verifyToken } from "../../../../../src/lib/verifyToken";
import {
  assignClientsToAccountant,
  findDirectoryUserByIdentity,
  listDirectoryUsers,
} from "../../../../../src/lib/userDirectory";

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
      return NextResponse.json({ clients: [] });
    }

    const scope = new URL(req.url).searchParams.get("scope") === "mine"
      ? "mine"
      : "all";

    const users = await listDirectoryUsers({
      orgId: requester.orgId,
    });

    return NextResponse.json({
      clients: users
        .filter(
          (user) =>
            user.role === "client" &&
            user.orgId === requester.orgId &&
            (scope !== "mine" ||
              user.assignedAccountantId === requester.id),
        )
        .map((user) => ({
          id: user.id,
          email: user.email,
          status: user.status,
          name: user.fullName,
          phoneNumber: user.phoneNumber || "",
          invitedByEmail: user.invitedByEmail || "",
          joinedAt: user.createdAt,
          assignedAccountantId: user.assignedAccountantId || "",
          assignedAccountantName: user.assignedAccountantName || "",
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

export async function POST(req: Request) {
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

    if (requesterRole !== "ACCOUNTANT") {
      return NextResponse.json(
        { error: "Only accountants can move clients to My Clients" },
        { status: 403 },
      );
    }

    if (!requester.orgId) {
      return NextResponse.json(
        { error: "Accountant organization is missing" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const clientIds = Array.isArray(body.clientIds)
      ? body.clientIds
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      : [];

    if (clientIds.length === 0) {
      return NextResponse.json(
        { error: "At least one client id is required" },
        { status: 400 },
      );
    }

    const orgUsers = await listDirectoryUsers({
      orgId: requester.orgId,
    });

    const validClientIds = new Set(
      orgUsers.filter((user) => user.role === "client").map((user) => user.id),
    );

    const filteredClientIds = clientIds.filter((id) => validClientIds.has(id));

    if (filteredClientIds.length === 0) {
      return NextResponse.json(
        { error: "No valid clients were selected" },
        { status: 400 },
      );
    }

    const assignments = await assignClientsToAccountant({
      clientIds: filteredClientIds,
      accountantId: requester.id,
      orgId: requester.orgId,
    });

    return NextResponse.json({
      success: true,
      assigned_accountant_id: requester.id,
      assigned_count: assignments.length,
      client_ids: assignments.map((assignment) => assignment.id),
    });
  } catch (error) {
    console.error("Assign clients error:", error);
    return NextResponse.json(
      { error: "Failed to assign clients" },
      { status: 500 },
    );
  }
}
