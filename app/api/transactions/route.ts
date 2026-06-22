import { NextResponse } from "next/server";
import {
  listCoreEntities,
  listCoreProperties,
  listCoreTransactionsByProperty,
  type CoreEntity,
  type CoreProperty,
  type CorePropertyTransactionRow,
  type CoreTransactionListItem,
} from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";
import { getRoleIdsByNames } from "@/src/lib/roles";
import {
  type DirectoryUser,
  findDirectoryUserByIdentity,
  listDirectoryUsers,
  type VerifiedTokenLike,
} from "@/src/lib/userDirectory";
import { verifyToken } from "@/src/lib/verifyToken";

type TransactionCollationContext = {
  client: DirectoryUser;
  entity: CoreEntity;
  property: CoreProperty;
};

function mergePropertyTransaction(
  byId: Map<string, CoreTransactionListItem>,
  row: CorePropertyTransactionRow,
  context: TransactionCollationContext,
) {
  const existing = byId.get(row.transactionId);
  if (existing) {
    if (!existing.propertyIds.includes(context.property.id)) {
      existing.propertyIds.push(context.property.id);
    }
    if (!existing.propertyNames.includes(context.property.name)) {
      existing.propertyNames.push(context.property.name);
    }
    existing.clientShareGross =
      (existing.clientShareGross ?? 0) + row.splitGrossAmount;
    existing.clientShareGst = (existing.clientShareGst ?? 0) + row.splitGstAmount;
    existing.clientShareNet = (existing.clientShareNet ?? 0) + row.splitNetAmount;
    return;
  }

  byId.set(row.transactionId, {
    id: row.transactionId,
    type: row.transactionType,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    subcategoryId: row.subcategoryId,
    subcategoryName: row.subcategoryName,
    invoiceDate: row.invoiceDate,
    grossAmount: row.transactionGrossAmount,
    gstAmount: row.transactionGstAmount,
    netAmount: row.transactionNetAmount,
    description: row.description,
    internalRemarks: null,
    isAssetPurchase: row.isAssetPurchase,
    assetClass: null,
    effectiveLifeYears: null,
    ruleId: row.ruleId,
    reviewStatus: row.reviewStatus,
    clientId: context.client.id,
    clientName: context.client.fullName,
    entityId: context.entity.id,
    entityName: context.entity.name,
    propertyIds: [context.property.id],
    propertyNames: [context.property.name],
    clientShareGross: row.splitGrossAmount,
    clientShareGst: row.splitGstAmount,
    clientShareNet: row.splitNetAmount,
    metadata: {},
    createdAt: "",
    updatedAt: "",
  });
}

async function listTransactionsFromClientProperties(
  token: string,
  client: DirectoryUser,
) {
  const byId = new Map<string, CoreTransactionListItem>();
  const entities = await listCoreEntities(token, { clientId: client.id });

  await Promise.all(
    entities.map(async (entity) => {
      try {
        const properties = await listCoreProperties(token, entity.id);
        await Promise.all(
          properties.map(async (property) => {
            try {
              const rows = await listCoreTransactionsByProperty(
                token,
                property.id,
              );
              for (const row of rows) {
                mergePropertyTransaction(byId, row, {
                  client,
                  entity,
                  property,
                });
              }
            } catch (error) {
              console.error("Failed to load property transactions", {
                clientId: client.id,
                entityId: entity.id,
                propertyId: property.id,
                message: error instanceof Error ? error.message : String(error),
              });
            }
          }),
        );
      } catch (error) {
        console.error("Failed to load entity properties", {
          clientId: client.id,
          entityId: entity.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );

  return Array.from(byId.values());
}

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  try {
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
    if (["client", "user"].includes(requesterRole)) {
      const items = await listTransactionsFromClientProperties(token, requester);
      return NextResponse.json({
        items: items
          .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate)),
      });
    }

    if (!["admin", "accountant"].includes(requesterRole)) {
      return NextResponse.json(
        { error: "You are not allowed to view transactions" },
        { status: 403 },
      );
    }

    if (!requester.orgId) {
      return NextResponse.json({ items: [] });
    }

    const clientRoleIds = await getRoleIdsByNames(["client", "user"]);
    if (clientRoleIds.length === 0) {
      return NextResponse.json(
        { error: "Client role is missing in the database" },
        { status: 500 },
      );
    }

    const orgClients = await listDirectoryUsers({
      orgId: requester.orgId,
      roleIds: clientRoleIds,
    });
    // Accountants only see transactions for clients assigned to them
    // (users.assigned_accountant_id). Admins keep org-wide visibility.
    const clients =
      requesterRole === "accountant"
        ? orgClients.filter(
            (client) => client.assignedAccountantId === requester.id,
          )
        : orgClients;
    const responses = await Promise.all(
      clients.map(async (client) => {
        try {
          return await listTransactionsFromClientProperties(token, client);
        } catch (error) {
          console.error("Failed to load client transactions", {
            clientId: client.id,
            message: error instanceof Error ? error.message : String(error),
          });
          return [];
        }
      }),
    );

    return NextResponse.json({
      items: responses
        .flat()
        .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate)),
    });
  } catch (error) {
    return renderUpstreamError("GET /api/transactions", error);
  }
}
