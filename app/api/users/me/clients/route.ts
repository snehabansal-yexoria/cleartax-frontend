import { NextResponse } from "next/server";
import { verifyToken } from "@/src/lib/verifyToken";
import { getRoleIdByName } from "@/src/lib/roles";
import {
  assignClientsToAccountant,
  findDirectoryUserByIdentity,
  listDirectoryUsers,
  type VerifiedTokenLike,
} from "@/src/lib/userDirectory";
import {
  getCoreApiBearerFromRequest,
  listCoreEntities,
  listCoreProperties,
  listCoreUsers,
} from "@/src/lib/coreApi";

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

    const token = getCoreApiBearerFromRequest(req);

    // Fetch entities for each client and list of core users in parallel
    const entitiesPromises = clients.map((client) =>
      listCoreEntities(token, { clientId: client.id }).catch((err) => {
        console.error(`Error fetching entities for client ${client.id}:`, err);
        return [];
      }),
    );

    const coreUsersPromise = listCoreUsers(token).catch((err) => {
      console.error("Error fetching core users:", err);
      return [];
    });

    const [allEntitiesLists, coreUsers] = await Promise.all([
      Promise.all(entitiesPromises),
      coreUsersPromise,
    ]);
    const allEntities = allEntitiesLists.flat();

    // Map user id to actual phone number from Core API
    const corePhoneMap = new Map<string, string>();
    for (const u of coreUsers) {
      if (u.phoneNumber) {
        corePhoneMap.set(u.id, u.phoneNumber);
      }
    }

    // Fetch properties for each entity in parallel
    const propertiesPromises = allEntities.map((entity) =>
      listCoreProperties(token, entity.id)
        .then((props) => ({
          clientId: entity.createdFor,
          count: props.length,
        }))
        .catch((err) => {
          console.error(`Error fetching properties for entity ${entity.id}:`, err);
          return { clientId: entity.createdFor, count: 0 };
        }),
    );

    const propertiesResults = await Promise.all(propertiesPromises);

    // Map clientId to total properties count
    const propertiesCountMap = new Map<string, number>();
    for (const result of propertiesResults) {
      const current = propertiesCountMap.get(result.clientId) || 0;
      propertiesCountMap.set(result.clientId, current + result.count);
    }

    return NextResponse.json({
      clients: clients
        .filter(
          (user) =>
            requesterRole === "admin" ||
            (scope === "mine"
              ? user.assignedAccountantId === requester.id
              : true),
        )
        .map((user) => ({
          id: user.id,
          email: user.email,
          status: user.status,
          name: user.fullName,
          phoneNumber: corePhoneMap.get(user.id) || user.phoneNumber || "",
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
          propertiesCount: propertiesCountMap.get(user.id) || 0,
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
