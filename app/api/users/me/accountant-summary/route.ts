import { NextResponse } from "next/server";
import { verifyToken } from "@/src/lib/verifyToken";
import { getRoleIdByName } from "@/src/lib/roles";
import {
  findDirectoryUserByIdentity,
  listDirectoryUsers,
  type VerifiedTokenLike,
} from "@/src/lib/userDirectory";
import {
  getCoreApiBearerFromRequest,
  listCoreEntities,
  listCoreProperties,
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
        { error: "You are not allowed to view accountant summary" },
        { status: 403 },
      );
    }

    if (!requester.orgId) {
      return NextResponse.json({ totalProperties: 0, totalMarketValue: 0 });
    }

    const token = getCoreApiBearerFromRequest(req);
    const clientRoleId = await getRoleIdByName("client");

    if (!clientRoleId) {
      return NextResponse.json(
        { error: "Client role is missing in the database" },
        { status: 500 },
      );
    }

    // List all client users under the same organization
    const clients = await listDirectoryUsers({
      orgId: requester.orgId,
      roleIds: [clientRoleId],
    });

    // Filter to clients assigned to this accountant
    const myClients = clients.filter(
      (user) => user.assignedAccountantId === requester.id,
    );

    let totalProperties = 0;
    let totalMarketValue = 0;

    // Fetch entities for all of our clients in parallel
    const entitiesPromises = myClients.map((client) =>
      listCoreEntities(token, { clientId: client.id }).catch((err) => {
        console.error(`Error fetching entities for client ${client.id}:`, err);
        return [];
      }),
    );

    const allEntitiesLists = await Promise.all(entitiesPromises);
    const allEntities = allEntitiesLists.flat();

    // Fetch properties for all entities in parallel
    const propertiesPromises = allEntities.map((entity) =>
      listCoreProperties(token, entity.id).catch((err) => {
        console.error(`Error fetching properties for entity ${entity.id}:`, err);
        return [];
      }),
    );

    const allPropertiesLists = await Promise.all(propertiesPromises);
    for (const propertiesList of allPropertiesLists) {
      for (const property of propertiesList) {
        totalProperties += 1;
        totalMarketValue += property.estimatedMarketValue || 0;
      }
    }

    return NextResponse.json({
      totalProperties,
      totalMarketValue,
    });
  } catch (error) {
    console.error("Accountant summary stats fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch summary stats" },
      { status: 500 },
    );
  }
}
