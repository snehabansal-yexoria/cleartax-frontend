import { NextResponse } from "next/server";
import { verifyToken } from "@/src/lib/verifyToken";
import { getRoleIdByName } from "@/src/lib/roles";
import {
  assignClientsToAccountant,
  findDirectoryUserByIdentity,
  type VerifiedTokenLike,
} from "@/src/lib/userDirectory";
import {
  CoreApiError,
  getCoreApiBearerFromRequest,
  listCoreClients,
} from "@/src/lib/coreApi";
import { logError } from "@/src/lib/log";

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
  const scope =
    new URL(req.url).searchParams.get("scope") === "mine" ? "mine" : "all";

  try {
    // Single backend call. The core API resolves the caller, enforces role,
    // and computes property counts, totals, invite status, inviter email and
    // assignment flags in one SQL query — no per-client/per-entity fan-out.
    const clients = await listCoreClients(getCoreApiBearerFromRequest(req), {
      scope,
    });

    return NextResponse.json({
      clients: clients.map((c) => ({
        id: c.id,
        email: c.email,
        status: c.status,
        name: c.fullName,
        phoneNumber: c.phoneNumber,
        invitedByEmail: c.invitedByEmail,
        joinedAt: c.joinedAt,
        assignedAccountantId: c.assignedAccountantId,
        assignedAccountantName: c.assignedAccountantName,
        isAssignedToCurrentAccountant: c.isAssignedToCurrentAccountant,
        isAssignedToAnotherAccountant: c.isAssignedToAnotherAccountant,
        propertiesCount: c.propertiesCount,
        totalMarketValue: c.totalMarketValue,
      })),
    });
  } catch (error) {
    logError("Fetch clients failed", error, {
      route: "GET /api/users/me/clients",
    });
    // Forward the upstream status (e.g. 403 for an unauthorized role).
    const status = error instanceof CoreApiError ? error.status : 500;
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status },
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
    logError("Assign clients failed", error, {
      route: "POST /api/users/me/clients",
    });
    return NextResponse.json(
      { error: "Failed to assign clients" },
      { status: 500 },
    );
  }
}
