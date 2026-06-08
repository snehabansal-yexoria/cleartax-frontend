import { NextResponse } from "next/server";
import {
  createCoreTransactionForEntity,
  listCoreTransactionsByEntity,
} from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await context.params;
  if (id.startsWith("demo-")) {
    const demoTransactions: Record<string, any[]> = {
      "demo-ent-1": [
        {
          id: "demo-tx-1",
          type: "revenue",
          categoryId: 1,
          categoryName: "Rental Income",
          subcategoryId: 11,
          subcategoryName: "Gross Rent",
          invoiceDate: "2026-05-15",
          grossAmount: 4200,
          gstAmount: 0,
          netAmount: 4200,
          description: "Rent - 24 Darling St",
          internalRemarks: null,
          isAssetPurchase: false,
          assetClass: null,
          effectiveLifeYears: null,
          ruleId: null,
          reviewStatus: "reviewed",
          entityId: "demo-ent-1",
          entityName: "Johnson Family Trust",
          propertyIds: ["demo-prop-1"],
          propertyNames: ["24 Darling Street"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: "demo-tx-2",
          type: "expense",
          categoryId: 2,
          categoryName: "Utilities",
          subcategoryId: 21,
          subcategoryName: "Water",
          invoiceDate: "2026-05-10",
          grossAmount: 312,
          gstAmount: 0,
          netAmount: 312,
          description: "Water Bill",
          internalRemarks: null,
          isAssetPurchase: false,
          assetClass: null,
          effectiveLifeYears: null,
          ruleId: null,
          reviewStatus: "reviewed",
          entityId: "demo-ent-1",
          entityName: "Johnson Family Trust",
          propertyIds: ["demo-prop-1"],
          propertyNames: ["24 Darling Street"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: "demo-tx-3",
          type: "expense",
          categoryId: 3,
          categoryName: "Loan Interest",
          subcategoryId: 31,
          subcategoryName: "Interest",
          invoiceDate: "2026-05-01",
          grossAmount: 2180,
          gstAmount: 0,
          netAmount: 2180,
          description: "Loan Interest",
          internalRemarks: null,
          isAssetPurchase: false,
          assetClass: null,
          effectiveLifeYears: null,
          ruleId: null,
          reviewStatus: "reviewed",
          entityId: "demo-ent-1",
          entityName: "Johnson Family Trust",
          propertyIds: ["demo-prop-1"],
          propertyNames: ["24 Darling Street"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: "demo-tx-4",
          type: "revenue",
          categoryId: 1,
          categoryName: "Rental Income",
          subcategoryId: 11,
          subcategoryName: "Gross Rent",
          invoiceDate: "2026-05-14",
          grossAmount: 3800,
          gstAmount: 0,
          netAmount: 3800,
          description: "Rent - 12 Church Avenue",
          internalRemarks: null,
          isAssetPurchase: false,
          assetClass: null,
          effectiveLifeYears: null,
          ruleId: null,
          reviewStatus: "reviewed",
          entityId: "demo-ent-1",
          entityName: "Johnson Family Trust",
          propertyIds: ["demo-prop-2"],
          propertyNames: ["12 Church Ave"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: "demo-tx-5",
          type: "expense",
          categoryId: 2,
          categoryName: "Utilities",
          subcategoryId: 22,
          subcategoryName: "Cleaning",
          invoiceDate: "2026-05-08",
          grossAmount: 670,
          gstAmount: 0,
          netAmount: 670,
          description: "Cleaning Bill",
          internalRemarks: null,
          isAssetPurchase: false,
          assetClass: null,
          effectiveLifeYears: null,
          ruleId: null,
          reviewStatus: "reviewed",
          entityId: "demo-ent-1",
          entityName: "Johnson Family Trust",
          propertyIds: ["demo-prop-2"],
          propertyNames: ["12 Church Ave"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      "demo-entity-1": [
        {
          id: "demo-tx-1",
          type: "revenue",
          categoryId: 1,
          categoryName: "Rental Income",
          subcategoryId: 11,
          subcategoryName: "Gross Rent",
          invoiceDate: "2026-05-15",
          grossAmount: 4200,
          gstAmount: 0,
          netAmount: 4200,
          description: "Rent - 24 Darling St",
          internalRemarks: null,
          isAssetPurchase: false,
          assetClass: null,
          effectiveLifeYears: null,
          ruleId: null,
          reviewStatus: "reviewed",
          entityId: "demo-entity-1",
          entityName: "Johnson Family Trust",
          propertyIds: ["demo-prop-1"],
          propertyNames: ["24 Darling Street"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: "demo-tx-2",
          type: "expense",
          categoryId: 2,
          categoryName: "Utilities",
          subcategoryId: 21,
          subcategoryName: "Water",
          invoiceDate: "2026-05-10",
          grossAmount: 312,
          gstAmount: 0,
          netAmount: 312,
          description: "Water Bill",
          internalRemarks: null,
          isAssetPurchase: false,
          assetClass: null,
          effectiveLifeYears: null,
          ruleId: null,
          reviewStatus: "reviewed",
          entityId: "demo-entity-1",
          entityName: "Johnson Family Trust",
          propertyIds: ["demo-prop-1"],
          propertyNames: ["24 Darling Street"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: "demo-tx-3",
          type: "expense",
          categoryId: 3,
          categoryName: "Loan Interest",
          subcategoryId: 31,
          subcategoryName: "Interest",
          invoiceDate: "2026-05-01",
          grossAmount: 2180,
          gstAmount: 0,
          netAmount: 2180,
          description: "Loan Interest",
          internalRemarks: null,
          isAssetPurchase: false,
          assetClass: null,
          effectiveLifeYears: null,
          ruleId: null,
          reviewStatus: "reviewed",
          entityId: "demo-entity-1",
          entityName: "Johnson Family Trust",
          propertyIds: ["demo-prop-1"],
          propertyNames: ["24 Darling Street"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: "demo-tx-4",
          type: "revenue",
          categoryId: 1,
          categoryName: "Rental Income",
          subcategoryId: 11,
          subcategoryName: "Gross Rent",
          invoiceDate: "2026-05-14",
          grossAmount: 3800,
          gstAmount: 0,
          netAmount: 3800,
          description: "Rent - 12 Church Avenue",
          internalRemarks: null,
          isAssetPurchase: false,
          assetClass: null,
          effectiveLifeYears: null,
          ruleId: null,
          reviewStatus: "reviewed",
          entityId: "demo-entity-1",
          entityName: "Johnson Family Trust",
          propertyIds: ["demo-prop-2"],
          propertyNames: ["12 Church Ave"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: "demo-tx-5",
          type: "expense",
          categoryId: 2,
          categoryName: "Utilities",
          subcategoryId: 22,
          subcategoryName: "Cleaning",
          invoiceDate: "2026-05-08",
          grossAmount: 670,
          gstAmount: 0,
          netAmount: 670,
          description: "Cleaning Bill",
          internalRemarks: null,
          isAssetPurchase: false,
          assetClass: null,
          effectiveLifeYears: null,
          ruleId: null,
          reviewStatus: "reviewed",
          entityId: "demo-entity-1",
          entityName: "Johnson Family Trust",
          propertyIds: ["demo-prop-2"],
          propertyNames: ["12 Church Ave"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      "demo-ent-2": [
        {
          id: "demo-tx-6",
          type: "revenue",
          categoryId: 1,
          categoryName: "Rental Income",
          subcategoryId: 11,
          subcategoryName: "Gross Rent",
          invoiceDate: "2026-05-20",
          grossAmount: 3900,
          gstAmount: 0,
          netAmount: 3900,
          description: "Rent - 8 Harbour Road",
          internalRemarks: null,
          isAssetPurchase: false,
          assetClass: null,
          effectiveLifeYears: null,
          ruleId: null,
          reviewStatus: "reviewed",
          entityId: "demo-ent-2",
          entityName: "SJ Holdings Pvt Ltd",
          propertyIds: ["demo-prop-3"],
          propertyNames: ["8 Harbour Road"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: "demo-tx-7",
          type: "expense",
          categoryId: 2,
          categoryName: "Utilities",
          subcategoryId: 23,
          subcategoryName: "Body Corporate",
          invoiceDate: "2026-05-18",
          grossAmount: 18400,
          gstAmount: 0,
          netAmount: 18400,
          description: "Body Corporate Fees",
          internalRemarks: null,
          isAssetPurchase: false,
          assetClass: null,
          effectiveLifeYears: null,
          ruleId: null,
          reviewStatus: "reviewed",
          entityId: "demo-ent-2",
          entityName: "SJ Holdings Pvt Ltd",
          propertyIds: ["demo-prop-3"],
          propertyNames: ["8 Harbour Road"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      "demo-entity-2": [
        {
          id: "demo-tx-6",
          type: "revenue",
          categoryId: 1,
          categoryName: "Rental Income",
          subcategoryId: 11,
          subcategoryName: "Gross Rent",
          invoiceDate: "2026-05-20",
          grossAmount: 3900,
          gstAmount: 0,
          netAmount: 3900,
          description: "Rent - 8 Harbour Road",
          internalRemarks: null,
          isAssetPurchase: false,
          assetClass: null,
          effectiveLifeYears: null,
          ruleId: null,
          reviewStatus: "reviewed",
          entityId: "demo-entity-2",
          entityName: "SJ Holdings Pvt Ltd",
          propertyIds: ["demo-prop-3"],
          propertyNames: ["8 Harbour Road"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: "demo-tx-7",
          type: "expense",
          categoryId: 2,
          categoryName: "Utilities",
          subcategoryId: 23,
          subcategoryName: "Body Corporate",
          invoiceDate: "2026-05-18",
          grossAmount: 18400,
          gstAmount: 0,
          netAmount: 18400,
          description: "Body Corporate Fees",
          internalRemarks: null,
          isAssetPurchase: false,
          assetClass: null,
          effectiveLifeYears: null,
          ruleId: null,
          reviewStatus: "reviewed",
          entityId: "demo-entity-2",
          entityName: "SJ Holdings Pvt Ltd",
          propertyIds: ["demo-prop-3"],
          propertyNames: ["8 Harbour Road"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      "demo-ent-3": []
    };
    return NextResponse.json({ items: demoTransactions[id] || [] });
  }

  try {
    const items = await listCoreTransactionsByEntity(token, id);
    return NextResponse.json({ items });
  } catch (error) {
    return renderUpstreamError(`GET /api/entities/${id}/transactions`, error);
  }
}

export async function POST(req: Request, context: RouteContext) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { id } = await context.params;
  if (id.startsWith("demo-")) {
    return NextResponse.json({
      id: "demo-new-tx",
      type: "expense",
      categoryId: 2,
      categoryName: "Utilities",
      subcategoryId: 21,
      subcategoryName: "Water",
      invoiceDate: new Date().toISOString().split('T')[0],
      grossAmount: 100,
      gstAmount: 0,
      netAmount: 100,
      description: "Mocked Transaction",
      internalRemarks: null,
      isAssetPurchase: false,
      assetClass: null,
      effectiveLifeYears: null,
      ruleId: null,
      reviewStatus: "reviewed",
      entityId: id,
      entityName: "Mocked Entity",
      propertyIds: [],
      propertyNames: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { status: 201 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const transaction = await createCoreTransactionForEntity(
      token,
      id,
      body as Record<string, unknown>,
    );
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    return renderUpstreamError(
      `POST /api/entities/${id}/transactions`,
      error,
      body,
    );
  }
}
