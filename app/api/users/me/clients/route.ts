import { NextResponse } from "next/server";
import { verifyToken } from "@/src/lib/verifyToken";
import { getRoleIdByName } from "@/src/lib/roles";
import {
  assignClientsToAccountant,
  findDirectoryUserByIdentity,
  listDirectoryUsers,
  type VerifiedTokenLike,
} from "@/src/lib/userDirectory";

async function getRequester(req: Request) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader) {
    return { error: "No token", status: 401 } as const;
  }

  const token = authHeader.split(" ")[1];
  const decoded = (await verifyToken(token)) as VerifiedTokenLike | null;

  if (!decoded || !decoded.sub) {
    return { error: "Invalid or expired token", status: 401 } as const;
  }

  const requester = await findDirectoryUserByIdentity({
    id: decoded.sub,
    email: decoded.email,
  });

  if (!requester) {
    return { error: "User not found", status: 404 } as const;
  }

  return { requester } as const;
}

export async function GET(req: Request) {
  try {
    const requesterResult = await getRequester(req);
    if ("error" in requesterResult) {
      return NextResponse.json(
        { error: requesterResult.error },
        { status: requesterResult.status },
      );
    }
    const { requester } = requesterResult;

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

    const scope =
      new URL(req.url).searchParams.get("scope") === "mine" ? "mine" : "all";
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
            requesterRole === "admin" ||
            (scope === "mine"
              ? user.assignedAccountantId === requester.id
              : user.assignedAccountantId !== requester.id),
        )
        .map((user) => ({
          id: user.id,
          email: user.email,
          status: user.status,
          name: user.fullName,
          phoneNumber: user.phoneNumber || "",
          invitedByEmail: user.invitedByEmail || "",
          joinedAt: user.createdAt,
          assignedAccountantId: user.assignedAccountantId,
          assignedAccountantName: user.assignedAccountantName,
          isAssignedToCurrentAccountant:
            Boolean(user.assignedAccountantId) &&
            user.assignedAccountantId === requester.id,
          isAssignedToAnotherAccountant:
            Boolean(user.assignedAccountantId) &&
            user.assignedAccountantId !== requester.id,
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
    const requesterResult = await getRequester(req);
    if ("error" in requesterResult) {
      return NextResponse.json(
        { error: requesterResult.error },
        { status: requesterResult.status },
      );
    }

    const { requester } = requesterResult;
    const requesterRole = requester.role.toLowerCase();

    if (requesterRole !== "accountant") {
      return NextResponse.json(
        { error: "Only accountants can add clients to their list" },
        { status: 403 },
      );
    }

    if (!requester.orgId) {
      return NextResponse.json(
        { error: "Accountant organization is missing" },
        { status: 400 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      clientIds?: unknown;
    };
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

    const clientRoleId = await getRoleIdByName("client");
    if (!clientRoleId) {
      return NextResponse.json(
        { error: "Client role is missing in the database" },
        { status: 500 },
      );
    }

    const assignedClientIds = await assignClientsToAccountant({
      clientIds,
      accountantId: requester.id,
      orgId: requester.orgId,
      clientRoleId,
    });

    if (assignedClientIds.length !== new Set(clientIds).size) {
      return NextResponse.json(
        {
          error:
            "Some clients are already added to an accountant or are not in your organization.",
          assignedClientIds,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      assignedClientIds,
      assignedAccountantId: requester.id,
      assignedCount: assignedClientIds.length,
    });
  } catch (error) {
    console.error("Assign clients error:", error);
    return NextResponse.json(
      { error: "Failed to assign clients" },
      { status: 500 },
    );
  }
}
