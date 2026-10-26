import { NextResponse } from "next/server";
import { verifyToken } from "@/src/lib/verifyToken";
import { getRoleIdByName } from "@/src/lib/roles";
import * as fs from "fs";
import * as path from "path";
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

function logDebug(message: string) {
  try {
    const logPath = path.join(process.cwd(), "debug-api.log");
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`, "utf8");
  } catch (err) {
    console.error("Failed to write to debug-api.log", err);
  }
}

async function getRequester(req: Request) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader) {
    logDebug("Authorization header missing");
    return { error: "No token", status: 401 } as const;
  }

  const token = authHeader.split(" ")[1];
  const decoded = (await verifyToken(token)) as VerifiedTokenLike | null;

  if (!decoded || !decoded.sub) {
    logDebug("Token verification failed");
    return { error: "Invalid or expired token", status: 401 } as const;
  }

  const requester = await findDirectoryUserByIdentity({
    id: decoded.sub,
    email: decoded.email,
  });

  if (!requester) {
    logDebug(`User not found in directory for email ${decoded.email}`);
    return { error: "User not found", status: 404 } as const;
  }

  return { requester } as const;
}

export async function GET(req: Request) {
  try {
    logDebug("GET /api/properties request received");
    const requesterResult = await getRequester(req);
    if ("error" in requesterResult) {
      logDebug(`Requester error: ${requesterResult.error}`);
      return NextResponse.json(
        { error: requesterResult.error },
        { status: requesterResult.status },
      );
    }
    const { requester } = requesterResult;
    const requesterRole = requester.role.toLowerCase();
    logDebug(`Requester found: id=${requester.id}, email=${requester.email}, role=${requesterRole}, orgId=${requester.orgId}`);

    const token = getCoreApiBearerFromRequest(req);

    if (["admin", "accountant"].includes(requesterRole)) {
      if (!requester.orgId) {
        logDebug("No orgId for admin/accountant");
        return NextResponse.json({ items: [] });
      }

      const clientRoleId = await getRoleIdByName("client");
      if (!clientRoleId) {
        logDebug("Client role ID not found in DB");
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
      logDebug(`Found ${clients.length} clients in org`);

      // Filter to clients assigned to this accountant
      // Wait, let's fetch entities for all clients in org, but log if any fail.
      const clientMap = new Map(clients.map((c) => [c.id, c.fullName]));

      // Fetch entities for all of our clients in parallel
      const entitiesPromises = clients.map((client) =>
        listCoreEntities(token, { clientId: client.id }).catch((err) => {
          logDebug(`Error fetching entities for client ${client.id} (${client.fullName}): ${err instanceof Error ? err.message : err}`);
          return [];
        }),
      );

      const allEntitiesLists = await Promise.all(entitiesPromises);
      const allEntities = allEntitiesLists.flat();
      logDebug(`Found total ${allEntities.length} entities across clients`);

      // Fetch properties for all entities in parallel
      const propertiesPromises = allEntities.map((entity) =>
        listCoreProperties(token, entity.id)
          .then((props) => {
            logDebug(`Fetched ${props.length} properties for entity ${entity.id} (${entity.name})`);
            return props.map((p) => ({
              id: p.id,
              name: p.name,
              entityId: entity.id,
              entityName: entity.name,
              clientId: entity.createdFor,
              clientName: clientMap.get(entity.createdFor) || "Unknown Client",
              locationText: p.locationText,
            }));
          })
          .catch((err) => {
            logDebug(`Error fetching properties for entity ${entity.id} (${entity.name}): ${err instanceof Error ? err.message : err}`);
            return [];
          }),
      );

      const allPropertiesLists = await Promise.all(propertiesPromises);
      const properties = allPropertiesLists.flat();
      logDebug(`Returning ${properties.length} properties total for accountant`);
      return NextResponse.json({ items: properties });
    }

    if (["client", "user"].includes(requesterRole)) {
      const entities = await listCoreEntities(token).catch((err) => {
        logDebug(`Error listing entities for client: ${err instanceof Error ? err.message : err}`);
        return [];
      });
      logDebug(`Found ${entities.length} entities for client`);

      const propertiesPromises = entities.map((entity) =>
        listCoreProperties(token, entity.id)
          .then((props) => {
            logDebug(`Fetched ${props.length} properties for entity ${entity.id} (${entity.name})`);
            return props.map((p) => ({
              id: p.id,
              name: p.name,
              entityId: entity.id,
              entityName: entity.name,
              locationText: p.locationText,
            }));
          })
          .catch((err) => {
            logDebug(`Error fetching properties for entity ${entity.id} (${entity.name}): ${err instanceof Error ? err.message : err}`);
            return [];
          }),
      );

      const allPropertiesLists = await Promise.all(propertiesPromises);
      const properties = allPropertiesLists.flat();
      logDebug(`Returning ${properties.length} properties total for client`);
      return NextResponse.json({ items: properties });
    }

    // Default for super_admin or unknown roles
    logDebug(`Role ${requesterRole} not supported for properties list`);
    return NextResponse.json({ items: [] });
  } catch (error) {
    logDebug(`Unhandled GET error: ${error instanceof Error ? error.stack : error}`);
    return NextResponse.json(
      { error: "Failed to fetch properties" },
      { status: 500 },
    );
  }
}
