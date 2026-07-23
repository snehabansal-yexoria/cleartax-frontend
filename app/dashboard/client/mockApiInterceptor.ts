"use client";

import { useEffect } from "react";

// Local storage key for persistent state
const STORAGE_KEY = "cleartax_mock_db_v1";

interface Beneficiary {
  id: number;
  name: string;
  ownershipPercentage: number;
}

interface Owner {
  entityBeneficiaryId: number | null;
  ownerName: string;
  ownershipPercentage: number;
}

interface LoanDetails {
  bank_name?: string;
  bsb_number?: string;
  loan_account_number?: string;
  loan_allocation_percentage?: number;
  loan_amount?: number;
  property_status_details?: {
    status: string;
    available_for_rent_date?: string;
    first_rental_income_date?: string;
    renovation_start_date?: string;
    renovation_end_date?: string;
  };
}

interface Property {
  id: string;
  name: string;
  entityId: string;
  estimatedMarketValue: number;
  purchaseAmount: number;
  purchaseDate: string;
  hasDepreciationSchedule: boolean;
  status: string;
  imageUrl?: string;
  owners: Owner[];
  loanDetails?: LoanDetails;
}

interface Entity {
  id: string;
  orgId: string;
  entityType: "trust" | "company" | "individual";
  name: string;
  createdAt: string;
  reconciled: boolean;
  propertiesCount: number;
  transactionsCount: number;
  beneficiaries: Beneficiary[];
}

interface Transaction {
  id: string;
  type: "revenue" | "expense";
  categoryId: number;
  categoryName: string;
  subcategoryId: number;
  subcategoryName: string;
  invoiceDate: string;
  grossAmount: number;
  gstAmount: number;
  netAmount: number;
  description: string | null;
  internalRemarks: string | null;
  isAssetPurchase: boolean;
  assetClass: string | null;
  effectiveLifeYears: number | null;
  ruleId: number | null;
  reviewStatus: "reviewed" | "unreviewed";
  clientId: string;
  clientName: string;
  entityId: string;
  entityName: string;
  propertyIds: string[];
  propertyNames: string[];
  clientShareGross: number | null;
  clientShareGst: number | null;
  clientShareNet: number | null;
}

interface Rule {
  id: number;
  entityId: string;
  name: string;
  conditions: any[];
  actions: any[];
}

interface MockDB {
  user: {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string;
  };
  entities: Entity[];
  properties: Property[];
  transactions: Transaction[];
  rules: Rule[];
  documents?: any[];
}

// Helpers to generate last 6 months of dates
function getPastDateString(monthsAgo: number, dayOfMonth: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(dayOfMonth).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Mock Categories data
const categories = {
  revenue: [
    { id: 1, name: "Rental Income", isSystem: true },
    { id: 2, name: "Interest Income", isSystem: true },
    { id: 3, name: "Capital Gains", isSystem: true },
  ],
  expense: [
    { id: 11, name: "Loan interest", isSystem: true },
    { id: 12, name: "Utilities", isSystem: true },
    { id: 13, name: "Maintenance", isSystem: true },
    { id: 14, name: "Rates", isSystem: true },
    { id: 15, name: "Insurance", isSystem: true },
  ],
};

const subcategories: Record<number, { id: number; name: string }[]> = {
  1: [
    { id: 101, name: "Residential Rent" },
    { id: 102, name: "Commercial Rent" },
  ],
  2: [
    { id: 201, name: "Bank Interest" },
  ],
  3: [
    { id: 301, name: "Property Sale" },
  ],
  11: [
    { id: 1101, name: "Monthly CBA Interest" },
    { id: 1102, name: "Monthly Westpac Interest" },
  ],
  12: [
    { id: 1201, name: "Water Bill" },
    { id: 1202, name: "Electricity Bill" },
  ],
  13: [
    { id: 1301, name: "Cleaning Services" },
    { id: 1302, name: "Plumbing Repairs" },
  ],
  14: [
    { id: 1401, name: "Council Rates" },
  ],
  15: [
    { id: 1501, name: "Landlord Insurance" },
  ],
};

// Initialize Mock DB state
function getInitialDB(): MockDB {
  const db: MockDB = {
    user: {
      id: "demo-client",
      fullName: "Sarah Johnson",
      email: "sarah.johnson@email.com",
      phoneNumber: "+61 400 123 456",
    },
    entities: [
      {
        id: "demo-entity-1",
        orgId: "demo-org",
        entityType: "trust",
        name: "Johnson Family Trust",
        createdAt: getPastDateString(6, 1),
        reconciled: false,
        propertiesCount: 3,
        transactionsCount: 0,
        beneficiaries: [
          { id: 1, name: "Sarah Johnson", ownershipPercentage: 60 },
          { id: 2, name: "Michael Johnson", ownershipPercentage: 40 },
        ],
      },
      {
        id: "demo-entity-2",
        orgId: "demo-org",
        entityType: "company",
        name: "SJ Holdings Pty Ltd",
        createdAt: getPastDateString(5, 1),
        reconciled: false,
        propertiesCount: 0,
        transactionsCount: 0,
        beneficiaries: [
          { id: 3, name: "Sarah Johnson", ownershipPercentage: 100 },
        ],
      },
      {
        id: "demo-entity-3",
        orgId: "demo-org",
        entityType: "individual",
        name: "Sarah Johnson",
        createdAt: getPastDateString(4, 1),
        reconciled: false,
        propertiesCount: 0,
        transactionsCount: 0,
        beneficiaries: [
          { id: 4, name: "Sarah Johnson", ownershipPercentage: 100 },
        ],
      },
    ],
    properties: [
      {
        id: "demo-prop-1",
        name: "24 Darling Street",
        entityId: "demo-entity-1",
        estimatedMarketValue: 1420000,
        purchaseAmount: 950000,
        purchaseDate: getPastDateString(60, 15),
        hasDepreciationSchedule: true,
        status: "Rented",
        imageUrl: "/house_darling_st.png",
        owners: [
          { entityBeneficiaryId: 1, ownerName: "Sarah Johnson", ownershipPercentage: 60 },
          { entityBeneficiaryId: 2, ownerName: "Michael Johnson", ownershipPercentage: 40 },
        ],
        loanDetails: {
          loan_amount: 680000,
        },
      },
      {
        id: "demo-prop-2",
        name: "12 Church Avenue",
        entityId: "demo-entity-1",
        estimatedMarketValue: 980000,
        purchaseAmount: 800000,
        purchaseDate: getPastDateString(40, 20),
        hasDepreciationSchedule: false,
        status: "Self Occupied",
        imageUrl: "/house_church_ave.png",
        owners: [
          { entityBeneficiaryId: 1, ownerName: "Sarah Johnson", ownershipPercentage: 60 },
          { entityBeneficiaryId: 2, ownerName: "Michael Johnson", ownershipPercentage: 40 },
        ],
        loanDetails: {
          loan_amount: 420000,
        },
      },
      {
        id: "demo-prop-3",
        name: "8 Harbour Road",
        entityId: "demo-entity-1",
        estimatedMarketValue: 450000,
        purchaseAmount: 750000,
        purchaseDate: getPastDateString(12, 10),
        hasDepreciationSchedule: false,
        status: "Available for Rent",
        imageUrl: "/house_harbour_rd.png",
        owners: [
          { entityBeneficiaryId: 1, ownerName: "Sarah Johnson", ownershipPercentage: 60 },
          { entityBeneficiaryId: 2, ownerName: "Michael Johnson", ownershipPercentage: 40 },
        ],
        loanDetails: {
          loan_amount: 510000,
        },
      },
    ],
    documents: [
      {
        id: "doc-1",
        file_name: "Trust Deed 2019.pdf",
        original_file_name: "Trust Deed 2019.pdf",
        document_type: "trust_deed",
        processing_status: "processed",
        file_size: 1420456,
        mime_type: "application/pdf",
        created_at: "2026-03-12T14:30:00Z",
        source: "direct",
        entityId: "demo-entity-1",
      },
      {
        id: "doc-2",
        file_name: "Depreciation Schedule.pdf",
        original_file_name: "Depreciation Schedule.pdf",
        document_type: "depreciation_schedule",
        processing_status: "processed",
        file_size: 852938,
        mime_type: "application/pdf",
        created_at: "2026-03-12T15:45:00Z",
        source: "direct",
        entityId: "demo-entity-1",
      },
      {
        id: "doc-3",
        file_name: "FY24 Tax Return.pdf",
        original_file_name: "FY24 Tax Return.pdf",
        document_type: "tax_return",
        processing_status: "processed",
        file_size: 2104958,
        mime_type: "application/pdf",
        created_at: "2026-02-28T09:15:00Z",
        source: "direct",
        entityId: "demo-entity-1",
      },
    ],
    transactions: [],
    rules: [
      {
        id: 1,
        entityId: "demo-entity-1",
        name: "CBA Rent CBA Auto-Allocation",
        conditions: [],
        actions: [],
      },
    ],
  };

  // Helper to enrich TypeScript transactions
  const enrichTx = (t: any): Transaction => {
    return {
      id: t.id,
      type: t.type,
      categoryId: t.categoryId,
      categoryName: t.categoryName,
      subcategoryId: t.subcategoryId,
      subcategoryName: t.subcategoryName,
      invoiceDate: t.invoiceDate,
      grossAmount: t.grossAmount,
      gstAmount: t.gstAmount,
      netAmount: t.netAmount,
      description: t.description || null,
      internalRemarks: null,
      isAssetPurchase: false,
      assetClass: null,
      effectiveLifeYears: null,
      ruleId: null,
      reviewStatus: "reviewed",
      clientId: t.clientId,
      clientName: t.clientName,
      entityId: t.entityId,
      entityName: t.entityName,
      propertyIds: t.propertyIds || [],
      propertyNames: t.propertyNames || [],
      clientShareGross: t.clientShareGross ?? t.grossAmount,
      clientShareGst: t.clientShareGst ?? 0,
      clientShareNet: t.clientShareNet ?? t.netAmount,
    };
  };

  // Seed the 5 recent transactions from Figma
  const todayDate = new Date();
  const todayStr = getPastDateString(0, todayDate.getDate());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = getPastDateString(0, yesterdayDate.getDate());

  const rawRecentTxs = [
    {
      id: "tx-recent-1",
      type: "revenue",
      categoryId: 1,
      categoryName: "Rental Income",
      subcategoryId: 101,
      subcategoryName: "Residential Rent",
      invoiceDate: todayStr,
      grossAmount: 4200,
      gstAmount: 0,
      netAmount: 4200,
      description: "Rent — 24 Darling St",
      clientId: "demo-client",
      clientName: "Sarah Johnson",
      entityId: "demo-entity-1",
      entityName: "Johnson Family Trust",
      propertyIds: ["demo-prop-1"],
      propertyNames: ["24 Darling Street"],
    },
    {
      id: "tx-recent-2",
      type: "expense",
      categoryId: 12,
      categoryName: "Utilities",
      subcategoryId: 1201,
      subcategoryName: "Water Bill",
      invoiceDate: todayStr,
      grossAmount: 312,
      gstAmount: 0,
      netAmount: 312,
      description: "Water bill",
      clientId: "demo-client",
      clientName: "Sarah Johnson",
      entityId: "demo-entity-1",
      entityName: "Johnson Family Trust",
      propertyIds: ["demo-prop-1"],
      propertyNames: ["24 Darling Street"],
    },
    {
      id: "tx-recent-3",
      type: "expense",
      categoryId: 11,
      categoryName: "Loan interest",
      subcategoryId: 1101,
      subcategoryName: "Monthly CBA Interest",
      invoiceDate: todayStr,
      grossAmount: 2180,
      gstAmount: 0,
      netAmount: 2180,
      description: "Loan interest",
      clientId: "demo-client",
      clientName: "Sarah Johnson",
      entityId: "demo-entity-1",
      entityName: "Johnson Family Trust",
      propertyIds: ["demo-prop-1"],
      propertyNames: ["24 Darling Street"],
    },
    {
      id: "tx-recent-4",
      type: "revenue",
      categoryId: 1,
      categoryName: "Rental Income",
      subcategoryId: 101,
      subcategoryName: "Residential Rent",
      invoiceDate: yesterdayStr,
      grossAmount: 3800,
      gstAmount: 0,
      netAmount: 3800,
      description: "Rent — 12 Church Ave",
      clientId: "demo-client",
      clientName: "Sarah Johnson",
      entityId: "demo-entity-1",
      entityName: "Johnson Family Trust",
      propertyIds: ["demo-prop-2"],
      propertyNames: ["12 Church Avenue"],
    },
    {
      id: "tx-recent-5",
      type: "expense",
      categoryId: 12,
      categoryName: "Utilities",
      subcategoryId: 1201,
      subcategoryName: "Cleaning Services",
      invoiceDate: yesterdayStr,
      grossAmount: 670,
      gstAmount: 0,
      netAmount: 670,
      description: "Cleaning bill",
      clientId: "demo-client",
      clientName: "Sarah Johnson",
      entityId: "demo-entity-1",
      entityName: "Johnson Family Trust",
      propertyIds: ["demo-prop-2"],
      propertyNames: ["12 Church Avenue"],
    },
    {
      id: "tx-recent-6",
      type: "revenue",
      categoryId: 1,
      categoryName: "Rental Income",
      subcategoryId: 101,
      subcategoryName: "Residential Rent",
      invoiceDate: getPastDateString(0, 1),
      grossAmount: 7442,
      gstAmount: 0,
      netAmount: 7442,
      description: "Rent - 24 Darling St",
      clientId: "demo-client",
      clientName: "Sarah Johnson",
      entityId: "demo-entity-1",
      entityName: "Johnson Family Trust",
      propertyIds: ["demo-prop-1"],
      propertyNames: ["24 Darling Street"],
    }
  ];

  db.transactions.push(...rawRecentTxs.map(enrichTx));

  const historicalData = [
    { monthsAgo: 1, p1Inc: 7000, p2Inc: 6500, p1Exp: 4500, p2Exp: 3800 },
    { monthsAgo: 2, p1Inc: 8000, p2Inc: 7500, p1Exp: 5000, p2Exp: 4200 },
    { monthsAgo: 3, p1Inc: 6500, p2Inc: 6500, p1Exp: 4200, p2Exp: 3800 },
    { monthsAgo: 4, p1Inc: 7500, p2Inc: 7000, p1Exp: 4500, p2Exp: 3800 },
    { monthsAgo: 5, p1Inc: 8000, p2Inc: 7500, p1Exp: 5000, p2Exp: 4000 },
    { monthsAgo: 6, p1Inc: 5958, p2Inc: 6800, p1Exp: 4708, p2Exp: 3730 },
  ];

  let txIdCounter = 7;
  for (const hist of historicalData) {
    const { monthsAgo, p1Inc, p2Inc, p1Exp, p2Exp } = hist;

    // Prop 1 Income
    db.transactions.push(enrichTx({
      id: `tx-hist-${txIdCounter++}`,
      type: "revenue",
      categoryId: 1,
      categoryName: "Rental Income",
      subcategoryId: 101,
      subcategoryName: "Residential Rent",
      invoiceDate: getPastDateString(monthsAgo, 15),
      grossAmount: p1Inc,
      gstAmount: 0,
      netAmount: p1Inc,
      description: "Rent - 24 Darling St",
      clientId: "demo-client",
      clientName: "Sarah Johnson",
      entityId: "demo-entity-1",
      entityName: "Johnson Family Trust",
      propertyIds: ["demo-prop-1"],
      propertyNames: ["24 Darling Street"],
    }));

    // Prop 2 Income
    db.transactions.push(enrichTx({
      id: `tx-hist-${txIdCounter++}`,
      type: "revenue",
      categoryId: 1,
      categoryName: "Rental Income",
      subcategoryId: 101,
      subcategoryName: "Residential Rent",
      invoiceDate: getPastDateString(monthsAgo, 15),
      grossAmount: p2Inc,
      gstAmount: 0,
      netAmount: p2Inc,
      description: "Rent - 12 Church Ave",
      clientId: "demo-client",
      clientName: "Sarah Johnson",
      entityId: "demo-entity-1",
      entityName: "Johnson Family Trust",
      propertyIds: ["demo-prop-2"],
      propertyNames: ["12 Church Avenue"],
    }));

    // Prop 1 Expense
    db.transactions.push(enrichTx({
      id: `tx-hist-${txIdCounter++}`,
      type: "expense",
      categoryId: 11,
      categoryName: "Loan interest",
      subcategoryId: 1101,
      subcategoryName: "Monthly CBA Interest",
      invoiceDate: getPastDateString(monthsAgo, 28),
      grossAmount: p1Exp,
      gstAmount: 0,
      netAmount: p1Exp,
      description: "Loan interest",
      clientId: "demo-client",
      clientName: "Sarah Johnson",
      entityId: "demo-entity-1",
      entityName: "Johnson Family Trust",
      propertyIds: ["demo-prop-1"],
      propertyNames: ["24 Darling Street"],
    }));

    // Prop 2 Expense
    db.transactions.push(enrichTx({
      id: `tx-hist-${txIdCounter++}`,
      type: "expense",
      categoryId: 12,
      categoryName: "Utilities",
      subcategoryId: 1201,
      subcategoryName: "Cleaning Services",
      invoiceDate: getPastDateString(monthsAgo, 28),
      grossAmount: p2Exp,
      gstAmount: 0,
      netAmount: p2Exp,
      description: "Utilities bill",
      clientId: "demo-client",
      clientName: "Sarah Johnson",
      entityId: "demo-entity-1",
      entityName: "Johnson Family Trust",
      propertyIds: ["demo-prop-2"],
      propertyNames: ["12 Church Avenue"],
    }));
  }

  return db;
}

// Read/write to localStorage
function readDB(): MockDB {
  if (typeof window === "undefined") {
    return getInitialDB();
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const db = getInitialDB();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return db;
  }
  try {
    return JSON.parse(stored);
  } catch {
    const db = getInitialDB();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return db;
  }
}

function writeDB(db: MockDB) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

// Generate enriched entities response matching backend route
function getEnrichedEntities(db: MockDB): any[] {
  return db.entities.map((entity) => {
    const entityProperties = db.properties.filter((p) => p.entityId === entity.id);
    return {
      ...entity,
      properties: entityProperties.map((p) => ({
        ...p,
        entityId: entity.id,
        entityName: entity.name,
      })),
    };
  });
}

// Handle request routing client-side
async function handleMockRequest(url: string, init?: RequestInit): Promise<Response> {
  const parsedUrl = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const path = parsedUrl.pathname;
  const method = init?.method?.toUpperCase() || "GET";

  const db = readDB();

  // Helper response builder
  const jsonResponse = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };

  // 1. GET /api/users/me
  if (path === "/api/users/me" && method === "GET") {
    return jsonResponse({
      ...db.user,
      id: db.user.id || "demo-client"
    });
  }

  // 2. GET /api/entities
  if (path === "/api/entities" && method === "GET") {
    const enriched = getEnrichedEntities(db);
    return jsonResponse({ items: enriched });
  }

  // 3. POST /api/entities
  if (path === "/api/entities" && method === "POST") {
    try {
      const body = JSON.parse(init?.body as string);
      const newEntity: Entity = {
        id: `entity-${Date.now()}`,
        orgId: "demo-org",
        entityType: body.entityType || "trust",
        name: body.name || "Unnamed Entity",
        createdAt: new Date().toISOString(),
        reconciled: false,
        propertiesCount: 0,
        transactionsCount: 0,
        beneficiaries: body.beneficiaries || [
          { id: Date.now(), name: db.user.fullName, ownershipPercentage: 100 },
        ],
      };
      db.entities.push(newEntity);
      writeDB(db);
      return jsonResponse(newEntity, 201);
    } catch {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }
  }

  // 4. GET /api/entities/[id]
  const entityMatch = path.match(/^\/api\/entities\/([^\/]+)$/);
  if (entityMatch && method === "GET") {
    const id = decodeURIComponent(entityMatch[1]);
    const entity = db.entities.find((e) => e.id === id);
    if (!entity) return jsonResponse({ error: "Entity not found" }, 404);
    
    // Enrich specific entity
    const entityProperties = db.properties.filter((p) => p.entityId === entity.id);
    const enriched = {
      ...entity,
      properties: entityProperties.map((p) => ({
        ...p,
        entityId: entity.id,
        entityName: entity.name,
      })),
    };
    return jsonResponse(enriched);
  }

  // 5. PATCH /api/entities/[id]
  if (entityMatch && method === "PATCH") {
    const id = decodeURIComponent(entityMatch[1]);
    const idx = db.entities.findIndex((e) => e.id === id);
    if (idx === -1) return jsonResponse({ error: "Entity not found" }, 404);
    
    try {
      const body = JSON.parse(init?.body as string);
      db.entities[idx] = {
        ...db.entities[idx],
        ...body,
      };
      writeDB(db);
      return jsonResponse(db.entities[idx]);
    } catch {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }
  }

  // 6. DELETE /api/entities/[id]
  if (entityMatch && method === "DELETE") {
    const id = decodeURIComponent(entityMatch[1]);
    const idx = db.entities.findIndex((e) => e.id === id);
    if (idx === -1) return jsonResponse({ error: "Entity not found" }, 404);
    
    db.entities.splice(idx, 1);
    // Cascade delete properties and transactions under this entity
    db.properties = db.properties.filter((p) => p.entityId !== id);
    db.transactions = db.transactions.filter((t) => t.entityId !== id);
    writeDB(db);
    return jsonResponse({ success: true });
  }

  // 7. POST /api/entities/[id]/properties
  const entityPropertiesMatch = path.match(/^\/api\/entities\/([^\/]+)\/properties$/);
  if (entityPropertiesMatch && method === "POST") {
    const entityId = decodeURIComponent(entityPropertiesMatch[1]);
    const entity = db.entities.find((e) => e.id === entityId);
    if (!entity) return jsonResponse({ error: "Entity not found" }, 404);

    try {
      const body = JSON.parse(init?.body as string);
      const newProperty: Property = {
        id: `prop-${Date.now()}`,
        name: body.name || "Unnamed Property",
        entityId: entityId,
        estimatedMarketValue: Number(body.estimated_market_value || 0),
        purchaseAmount: Number(body.purchase_amount || 0),
        purchaseDate: body.purchase_date || new Date().toISOString().split("T")[0],
        hasDepreciationSchedule: Boolean(body.has_depreciation_schedule),
        status: body.status || "Rented",
        imageUrl: body.image_url || undefined,
        owners: body.owners || [],
        loanDetails: body.loan_details || {},
      };

      db.properties.push(newProperty);
      
      // Increment propertiesCount
      entity.propertiesCount = (entity.propertiesCount || 0) + 1;
      writeDB(db);
      
      return jsonResponse(newProperty, 201);
    } catch {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }
  }

  // 8. GET /api/properties/[id]/transactions
  const propertyTransactionsMatch = path.match(/^\/api\/properties\/([^\/]+)\/transactions$/);
  if (propertyTransactionsMatch && method === "GET") {
    const propertyId = decodeURIComponent(propertyTransactionsMatch[1]);
    const prop = db.properties.find((p) => p.id === propertyId);
    if (!prop) return jsonResponse({ error: "Property not found" }, 404);

    // Map global transactions containing this propertyId to CorePropertyTransactionRow format
    const propTxs = db.transactions.filter((t) => t.propertyIds.includes(propertyId));
    const items = propTxs.map((t, idx) => ({
      transactionId: t.id,
      transactionType: t.type,
      categoryId: t.categoryId,
      categoryName: t.categoryName,
      subcategoryId: t.subcategoryId,
      subcategoryName: t.subcategoryName,
      invoiceDate: t.invoiceDate,
      description: t.description,
      transactionGrossAmount: t.grossAmount,
      transactionGstAmount: t.gstAmount,
      transactionNetAmount: t.netAmount,
      isAssetPurchase: t.isAssetPurchase,
      ruleId: t.ruleId,
      reviewStatus: t.reviewStatus,
      splitId: idx + 1,
      splitPercentage: 100,
      splitGrossAmount: t.grossAmount,
      splitGstAmount: t.gstAmount,
      splitNetAmount: t.netAmount,
    }));

    return jsonResponse({ items });
  }

  // 9. GET /api/properties/[id]
  const propertyMatch = path.match(/^\/api\/properties\/([^\/]+)$/);
  if (propertyMatch && method === "GET") {
    const id = decodeURIComponent(propertyMatch[1]);
    const prop = db.properties.find((p) => p.id === id);
    if (!prop) return jsonResponse({ error: "Property not found" }, 404);
    
    // Add entity details
    const ent = db.entities.find((e) => e.id === prop.entityId);
    const enriched = {
      ...prop,
      entityName: ent ? ent.name : "Individual",
    };
    return jsonResponse(enriched);
  }

  // 10. PATCH /api/properties/[id]
  if (propertyMatch && method === "PATCH") {
    const id = decodeURIComponent(propertyMatch[1]);
    const idx = db.properties.findIndex((p) => p.id === id);
    if (idx === -1) return jsonResponse({ error: "Property not found" }, 404);

    try {
      const body = JSON.parse(init?.body as string);
      db.properties[idx] = {
        ...db.properties[idx],
        ...body,
      };
      writeDB(db);
      return jsonResponse(db.properties[idx]);
    } catch {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }
  }

  // 11. DELETE /api/properties/[id]
  if (propertyMatch && method === "DELETE") {
    const id = decodeURIComponent(propertyMatch[1]);
    const idx = db.properties.findIndex((p) => p.id === id);
    if (idx === -1) return jsonResponse({ error: "Property not found" }, 404);

    const prop = db.properties[idx];
    const ent = db.entities.find((e) => e.id === prop.entityId);
    if (ent) {
      ent.propertiesCount = Math.max(0, (ent.propertiesCount || 1) - 1);
    }

    db.properties.splice(idx, 1);
    // Cascade delete transactions mapping this property
    db.transactions = db.transactions.filter((t) => !t.propertyIds.includes(id));
    writeDB(db);
    return jsonResponse({ success: true });
  }

  // 12. GET /api/transactions
  if (path === "/api/transactions" && method === "GET") {
    return jsonResponse({ items: db.transactions });
  }

  // 13. GET /api/clients/[id]/transactions
  const clientTransactionsMatch = path.match(/^\/api\/clients\/([^\/]+)\/transactions$/);
  if (clientTransactionsMatch && method === "GET") {
    // Return all transactions for simplicity (scope: Sarah Johnson client)
    return jsonResponse({ items: db.transactions });
  }

  // 14. GET /api/entities/[id]/transactions
  const entityTransactionsMatch = path.match(/^\/api\/entities\/([^\/]+)\/transactions$/);
  if (entityTransactionsMatch && method === "GET") {
    const entityId = decodeURIComponent(entityTransactionsMatch[1]);
    const entTxs = db.transactions.filter((t) => t.entityId === entityId);
    return jsonResponse({ items: entTxs });
  }

  // 15. GET /api/transactions/[id]
  const transactionMatch = path.match(/^\/api\/transactions\/([^\/]+)$/);
  if (transactionMatch && method === "GET") {
    const id = decodeURIComponent(transactionMatch[1]);
    const tx = db.transactions.find((t) => t.id === id);
    if (!tx) return jsonResponse({ error: "Transaction not found" }, 404);

    // Return detailed transaction with splits
    const detailedTx = {
      ...tx,
      splits: tx.propertyIds.map((pId, idx) => ({
        id: idx + 1,
        propertyId: pId,
        propertyName: tx.propertyNames[idx] || "Property Name",
        splitPercentage: 100,
        splitGrossAmount: tx.grossAmount,
        splitGstAmount: tx.gstAmount,
        splitNetAmount: tx.netAmount,
        allocations: [],
      })),
    };

    return jsonResponse(detailedTx);
  }

  // 16. POST /api/transactions
  // Alternatively, POST /api/entities/[id]/transactions
  const entityTransactionsPostMatch = path.match(/^\/api\/entities\/([^\/]+)\/transactions$/);
  if ((path === "/api/transactions" || entityTransactionsPostMatch) && method === "POST") {
    try {
      const body = JSON.parse(init?.body as string);
      const entityId = entityTransactionsPostMatch
        ? decodeURIComponent(entityTransactionsPostMatch[1])
        : body.entityId || "demo-entity-1";
        
      const ent = db.entities.find((e) => e.id === entityId);
      
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        type: body.type || "expense",
        categoryId: Number(body.categoryId || 11),
        categoryName: body.categoryName || "Loan interest",
        subcategoryId: Number(body.subcategoryId || 1101),
        subcategoryName: body.subcategoryName || "Monthly CBA Interest",
        invoiceDate: body.invoiceDate || new Date().toISOString().split("T")[0],
        grossAmount: Number(body.grossAmount || 0),
        gstAmount: Number(body.gstAmount || 0),
        netAmount: Number(body.netAmount || body.grossAmount || 0),
        description: body.description || "Manual Transaction",
        internalRemarks: body.internalRemarks || null,
        isAssetPurchase: Boolean(body.isAssetPurchase),
        assetClass: body.assetClass || null,
        effectiveLifeYears: body.effectiveLifeYears || null,
        ruleId: body.ruleId || null,
        reviewStatus: body.reviewStatus || "unreviewed",
        clientId: "demo-client",
        clientName: db.user.fullName,
        entityId: entityId,
        entityName: ent ? ent.name : "Individual",
        propertyIds: body.propertyIds || [],
        propertyNames: body.propertyNames || [],
        clientShareGross: Number(body.grossAmount || 0),
        clientShareGst: Number(body.gstAmount || 0),
        clientShareNet: Number(body.netAmount || body.grossAmount || 0),
      };

      db.transactions.push(newTx);
      writeDB(db);
      return jsonResponse(newTx, 201);
    } catch {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }
  }

  // 17. PATCH /api/transactions/[id]
  if (transactionMatch && method === "PATCH") {
    const id = decodeURIComponent(transactionMatch[1]);
    const idx = db.transactions.findIndex((t) => t.id === id);
    if (idx === -1) return jsonResponse({ error: "Transaction not found" }, 404);

    try {
      const body = JSON.parse(init?.body as string);
      
      // If categories or subcategories are changed, sync their names
      let categoryName = db.transactions[idx].categoryName;
      if (body.categoryId && body.categoryId !== db.transactions[idx].categoryId) {
        const found = [...categories.revenue, ...categories.expense].find((c) => c.id === body.categoryId);
        if (found) categoryName = found.name;
      }
      
      let subcategoryName = db.transactions[idx].subcategoryName;
      if (body.subcategoryId && body.subcategoryId !== db.transactions[idx].subcategoryId) {
        const subCats = Object.values(subcategories).flat();
        const foundSub = subCats.find((sc) => sc.id === body.subcategoryId);
        if (foundSub) subcategoryName = foundSub.name;
      }

      db.transactions[idx] = {
        ...db.transactions[idx],
        ...body,
        categoryName,
        subcategoryName,
      };

      writeDB(db);

      // Return details object format
      const detailedTx = {
        ...db.transactions[idx],
        splits: db.transactions[idx].propertyIds.map((pId, sIdx) => ({
          id: sIdx + 1,
          propertyId: pId,
          propertyName: db.transactions[idx].propertyNames[sIdx] || "Property Name",
          splitPercentage: 100,
          splitGrossAmount: db.transactions[idx].grossAmount,
          splitGstAmount: db.transactions[idx].gstAmount,
          splitNetAmount: db.transactions[idx].netAmount,
          allocations: [],
        })),
      };

      return jsonResponse(detailedTx);
    } catch {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }
  }

  // 18. DELETE /api/transactions/[id]
  if (transactionMatch && method === "DELETE") {
    const id = decodeURIComponent(transactionMatch[1]);
    const idx = db.transactions.findIndex((t) => t.id === id);
    if (idx === -1) return jsonResponse({ error: "Transaction not found" }, 404);

    db.transactions.splice(idx, 1);
    writeDB(db);
    return jsonResponse({ success: true });
  }

  // 19. GET /api/transactions/categories
  if (path === "/api/transactions/categories" && method === "GET") {
    const type = parsedUrl.searchParams.get("type");
    if (type === "revenue") {
      return jsonResponse(categories.revenue);
    }
    if (type === "expense") {
      return jsonResponse(categories.expense);
    }
    return jsonResponse([...categories.revenue, ...categories.expense]);
  }

  // 20. GET /api/transactions/categories/[categoryId]/sub-categories
  const subcategoryMatch = path.match(/^\/api\/transactions\/categories\/(\d+)\/sub-categories$/);
  if (subcategoryMatch && method === "GET") {
    const categoryId = parseInt(subcategoryMatch[1], 10);
    const subs = subcategories[categoryId] || [];
    return jsonResponse(subs);
  }

  // 21. GET /api/entities/[id]/transaction-rules
  const rulesMatch = path.match(/^\/api\/entities\/([^\/]+)\/transaction-rules$/);
  if (rulesMatch && method === "GET") {
    const entityId = decodeURIComponent(rulesMatch[1]);
    const entRules = db.rules.filter((r) => r.entityId === entityId);
    return jsonResponse({ items: entRules });
  }

  // 22. POST /api/entities/[id]/transaction-rules
  if (rulesMatch && method === "POST") {
    const entityId = decodeURIComponent(rulesMatch[1]);
    try {
      const body = JSON.parse(init?.body as string);
      const newRule: Rule = {
        id: Date.now(),
        entityId,
        name: body.name || "Auto Rule",
        conditions: body.conditions || [],
        actions: body.actions || [],
      };
      db.rules.push(newRule);
      writeDB(db);
      return jsonResponse(newRule, 201);
    } catch {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }
  }

  // 23. DELETE /api/entities/[id]/transaction-rules/[ruleId]
  const deleteRuleMatch = path.match(/^\/api\/entities\/([^\/]+)\/transaction-rules\/(\d+)$/);
  if (deleteRuleMatch && method === "DELETE") {
    const ruleId = parseInt(deleteRuleMatch[2], 10);
    const idx = db.rules.findIndex((r) => r.id === ruleId);
    if (idx === -1) return jsonResponse({ error: "Rule not found" }, 404);
    db.rules.splice(idx, 1);
    writeDB(db);
    return jsonResponse({ success: true });
  }

  // 24. GET /api/documents/presign
  if (path === "/api/documents/presign" && method === "GET") {
    const filename = parsedUrl.searchParams.get("filename") || "file.jpg";
    const docType = parsedUrl.searchParams.get("document_type") || "other";
    const entityId = parsedUrl.searchParams.get("entity_id") || "";
    const propertyId = parsedUrl.searchParams.get("property_id") || "";

    const docId = `doc-${Date.now()}`;
    
    // Add to mock database
    if (!db.documents) db.documents = [];
    db.documents.unshift({
      id: docId,
      file_name: filename,
      original_file_name: filename,
      document_type: docType,
      processing_status: "processed",
      file_size: 1420456,
      mime_type: filename.endsWith(".pdf") ? "application/pdf" : "image/jpeg",
      created_at: new Date().toISOString(),
      source: "direct",
      entityId,
      propertyId,
    });
    writeDB(db);

    return jsonResponse({
      upload_url: `/api/documents/mock-upload?file=${encodeURIComponent(filename)}`,
      s3_key: `mock-s3-key-${Date.now()}-${filename}`,
      document_id: docId,
    });
  }

  // 25. PUT /api/documents/mock-upload
  if (path === "/api/documents/mock-upload" && method === "PUT") {
    return new Response(null, { status: 200 });
  }

  // 26. GET /api/documents/download
  if (path === "/api/documents/download" && method === "GET") {
    const key = parsedUrl.searchParams.get("key") || "";
    if (key.includes("darling")) {
      return jsonResponse({ url: "/house_darling_st.png" });
    }
    if (key.includes("church")) {
      return jsonResponse({ url: "/house_church_ave.png" });
    }
    if (key.includes("harbour")) {
      return jsonResponse({ url: "/house_harbour_rd.png" });
    }
    return jsonResponse({ url: "/house_darling_st.png" });
  }

  // 26b. GET /api/documents/list
  if (path === "/api/documents/list" && method === "GET") {
    const entityId = parsedUrl.searchParams.get("entity_id") || "";
    const propertyId = parsedUrl.searchParams.get("property_id") || "";
    
    let filtered = db.documents || [];
    if (entityId) {
      filtered = filtered.filter((d: any) => d.entityId === entityId);
    }
    if (propertyId) {
      filtered = filtered.filter((d: any) => d.propertyId === propertyId);
    }
    return jsonResponse({ items: filtered });
  }

  // 27. GET /api/users/me/clients?scope=mine
  if (path === "/api/users/me/clients" && method === "GET") {
    return jsonResponse({ items: [] });
  }

  // Catch all: default to local original fetch fallback
  return new Response(JSON.stringify({ error: `Mock API: Path not found: ${method} ${path}` }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

// Global flag to enable/disable the client-dashboard mock API layer.
//
// Defaults OFF: the client dashboard talks to the real /api/* backend routes
// (which proxy to the Go core API). Set NEXT_PUBLIC_ENABLE_MOCK_CLIENT_API=true
// to re-enable the localStorage-backed demo mock for offline/UI-only work. This
// is the single switch for the mock↔real toggle — flip it per-environment
// rather than editing this constant.
const ENABLE_MOCK_API =
  (process.env.NEXT_PUBLIC_ENABLE_MOCK_CLIENT_API ?? "false").toLowerCase() ===
  "true";

let originalFetch: typeof window.fetch | null = null;

export function useMockClientApi() {
  useEffect(() => {
    if (typeof window === "undefined" || !ENABLE_MOCK_API) return;

    // Hook window.fetch
    if (!originalFetch) {
      originalFetch = window.fetch;
    }

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" 
        ? input 
        : input instanceof URL 
          ? input.toString() 
          : input.url;

      // Intercept relative and absolute paths starting with /api/
      // Exclude documents download if we just want it to load directly
      if (url.startsWith("/api/") || url.includes("/api/")) {
        // Find relative start index of /api/
        const idx = url.indexOf("/api/");
        const relativeUrl = url.slice(idx);
        
        try {
          console.log(`[Mock Client API Interceptor] Intercepted: ${init?.method || "GET"} ${relativeUrl}`);
          return await handleMockRequest(relativeUrl, init);
        } catch (e) {
          console.error(`[Mock Client API Interceptor] Interceptor failed for: ${relativeUrl}`, e);
          return new Response(JSON.stringify({ error: "Mock API error" }), { status: 500 });
        }
      }

      return originalFetch!(input, init);
    };

    return () => {
      // Restore original fetch on unmount
      if (originalFetch) {
        window.fetch = originalFetch;
      }
    };
  }, []);
}
