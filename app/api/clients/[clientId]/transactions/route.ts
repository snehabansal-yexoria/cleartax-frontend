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
import { findDirectoryUserByIdentity } from "@/src/lib/userDirectory";

type RouteContext = { params: Promise<{ clientId: string }> };

function mergePropertyTransaction(
  byId: Map<string, CoreTransactionListItem>,
  row: CorePropertyTransactionRow,
  context: {
    clientId: string;
    clientName: string;
    entity: CoreEntity;
    property: CoreProperty;
  },
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
    existing.clientShareGst =
      (existing.clientShareGst ?? 0) + row.splitGstAmount;
    existing.clientShareNet =
      (existing.clientShareNet ?? 0) + row.splitNetAmount;
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
    clientId: context.clientId,
    clientName: context.clientName,
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
  clientId: string,
) {
  const byId = new Map<string, CoreTransactionListItem>();
  const client = await findDirectoryUserByIdentity({ id: clientId });
  const clientName = client?.fullName ?? "";
  const entities = await listCoreEntities(token, { clientId });

  await Promise.all(
    entities.map(async (entity) => {
      const properties = await listCoreProperties(token, entity.id);
      await Promise.all(
        properties.map(async (property) => {
          const rows = await listCoreTransactionsByProperty(token, property.id);
          for (const row of rows) {
            mergePropertyTransaction(byId, row, {
              clientId,
              clientName,
              entity,
              property,
            });
          }
        }),
      );
    }),
  );

  return Array.from(byId.values()).sort((a, b) =>
    b.invoiceDate.localeCompare(a.invoiceDate),
  );
}

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { clientId } = await context.params;
  try {
    const items = await listTransactionsFromClientProperties(token, clientId);
    return NextResponse.json({ items });
  } catch (error) {
    return renderUpstreamError(
      `GET /api/clients/${clientId}/transactions`,
      error,
    );
  }
}
