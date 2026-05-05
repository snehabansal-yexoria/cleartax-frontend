import { normalizeRoleName } from "./roleNames";

type CoreApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

type CoreApiRequestOptions = {
  method?: CoreApiMethod;
  token?: string;
  body?: unknown;
};

type RawRecord = Record<string, unknown>;

export type CoreUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  roleId: number | null;
  orgId: string;
  orgName: string;
  status: string;
  phoneNumber: string;
  invitedBy: string;
  invitedByEmail: string;
  createdAt: string | null;
  assignedAccountantId: string;
  assignedAccountantName: string;
};

export type CoreOrganization = {
  id: string;
  name: string;
  email: string;
  tenantCode: string;
};

export type EntityType =
  | "individual"
  | "partnership"
  | "company"
  | "trust"
  | "smsf";

export type PropertyType = "residential" | "commercial" | "vacant_land";

export type CoreBeneficiary = {
  id?: number;
  name: string;
  userId?: string | null;
  ownershipPercentage: number;
  position?: number;
};

export type CoreEntity = {
  id: string;
  orgId: string;
  entityType: EntityType;
  name: string;
  createdFor: string;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  beneficiaries: CoreBeneficiary[];
};

export type CorePropertyOwner = {
  id?: number;
  entityBeneficiaryId?: number | null;
  ownerName: string;
  userId?: string | null;
  ownershipPercentage: number;
  position?: number;
};

export type CoreProperty = {
  id: string;
  orgId: string;
  entityId: string;
  createdFor: string;
  name: string;
  propertyType: PropertyType;
  locationText: string;
  estimatedMarketValue: number;
  purchaseDate: string;
  purchaseAmount: number;
  hasDepreciationSchedule: boolean;
  status: string;
  imageUrl: string | null;
  loanDetails: Record<string, unknown> | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  owners: CorePropertyOwner[];
};

function getCoreApiBaseUrl() {
  const baseUrl =
    process.env.CORE_API_BASE_URL || process.env.NEXT_PUBLIC_CORE_API_BASE_URL;

  if (!baseUrl) {
    throw new Error("CORE_API_BASE_URL is not configured");
  }

  return baseUrl.replace(/\/+$/, "");
}

function getJsonArray(payload: unknown): RawRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(
      (item): item is RawRecord => typeof item === "object" && item !== null,
    );
  }

  if (typeof payload !== "object" || payload === null) {
    return [];
  }

  const record = payload as RawRecord;
  const candidates = [
    record.data,
    record.items,
    record.users,
    record.organisations,
    record.organizations,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (item): item is RawRecord => typeof item === "object" && item !== null,
      );
    }
  }

  return [];
}

function getJsonObject(payload: unknown): RawRecord {
  if (typeof payload !== "object" || payload === null) {
    return {};
  }

  const record = payload as RawRecord;
  const candidates = [
    record.data,
    record.item,
    record.user,
    record.organization,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "object" && candidate !== null) {
      return candidate as RawRecord;
    }
  }

  return record;
}

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function toNumberValue(value: unknown) {
  const asNumber =
    typeof value === "number"
      ? value
      : Number.parseInt(toStringValue(value), 10);
  return Number.isNaN(asNumber) ? null : asNumber;
}

function toFloatValue(value: unknown) {
  const asNumber =
    typeof value === "number" ? value : Number.parseFloat(toStringValue(value));
  return Number.isNaN(asNumber) ? 0 : asNumber;
}

function getRoleName(raw: RawRecord) {
  return normalizeRoleName(raw.role || raw.role_name || raw.roleName);
}

export function getCoreApiBearerFromRequest(req: Request, fallbackToken = "") {
  const header = req.headers.get("authorization") || "";
  const [scheme, value] = header.split(" ");

  if (scheme?.toLowerCase() === "bearer" && value) {
    return value;
  }

  return fallbackToken;
}

export function getCoreRoleId(role: string) {
  const normalized = normalizeRoleName(role);
  const roleIds: Record<string, number> = {
    super_admin: 1,
    admin: 2,
    accountant: 3,
    client: 4,
    user: 4,
  };

  return roleIds[normalized] ?? null;
}

export function normalizeCoreUser(raw: RawRecord): CoreUser {
  return {
    id: toStringValue(raw.id || raw.user_id || raw.userId),
    email: toStringValue(raw.email),
    fullName: toStringValue(raw.full_name || raw.fullName),
    role: getRoleName(raw),
    roleId: toNumberValue(raw.role_id || raw.roleId),
    orgId: toStringValue(raw.org_id || raw.organization_id || raw.orgId),
    orgName: toStringValue(
      raw.org_name || raw.organization_name || raw.orgName,
    ),
    status: toStringValue(
      raw.status || (raw.is_active === false ? "INACTIVE" : "ACTIVE"),
    ),
    phoneNumber: toStringValue(
      raw.phone || raw.phone_number || raw.phoneNumber,
    ),
    invitedBy: toStringValue(raw.invited_by || raw.invitedBy || raw.created_by),
    invitedByEmail: toStringValue(raw.invited_by_email || raw.invitedByEmail),
    createdAt:
      raw.created_at == null && raw.createdAt == null
        ? null
        : toStringValue(raw.created_at || raw.createdAt) || null,
    assignedAccountantId: toStringValue(
      raw.assigned_accountant_id || raw.assignedAccountantId,
    ),
    assignedAccountantName: toStringValue(
      raw.assigned_accountant_name || raw.assignedAccountantName,
    ),
  };
}

export function normalizeCoreOrganization(raw: RawRecord): CoreOrganization {
  return {
    id: toStringValue(raw.id || raw.org_id || raw.orgId),
    name: toStringValue(raw.name || raw.org_name || raw.orgName),
    email: toStringValue(raw.org_email || raw.email),
    tenantCode: toStringValue(raw.tenant_code || raw.tenantCode),
  };
}

export class CoreApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly code: string | null;
  readonly upstreamMessage: string | null;
  readonly bodyExcerpt: string;
  readonly method: string;
  readonly path: string;
  readonly payload: unknown;

  constructor(init: {
    status: number;
    statusText: string;
    code: string | null;
    upstreamMessage: string | null;
    bodyExcerpt: string;
    method: string;
    path: string;
    payload: unknown;
  }) {
    const upstream = init.upstreamMessage ? `: ${init.upstreamMessage}` : "";
    const excerpt = init.bodyExcerpt ? ` — body: ${init.bodyExcerpt}` : "";
    super(
      `Core API ${init.method} ${init.path} failed (${init.status} ${init.statusText})${upstream}${excerpt}`,
    );
    this.name = "CoreApiError";
    this.status = init.status;
    this.statusText = init.statusText;
    this.code = init.code;
    this.upstreamMessage = init.upstreamMessage;
    this.bodyExcerpt = init.bodyExcerpt;
    this.method = init.method;
    this.path = init.path;
    this.payload = init.payload;
  }
}

function readStringField(payload: unknown, key: string): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const value = (payload as RawRecord)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function coreApiRequest<T = unknown>(
  path: string,
  { method = "GET", token, body }: CoreApiRequestOptions = {},
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${getCoreApiBaseUrl()}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;
  let parseError: Error | null = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      parseError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (!response.ok) {
    const upstreamMessage =
      readStringField(payload, "message") || readStringField(payload, "error");
    const bodyExcerpt = parseError
      ? text.slice(0, 500).replace(/\s+/g, " ").trim()
      : "";
    throw new CoreApiError({
      status: response.status,
      statusText: response.statusText,
      code: readStringField(payload, "code"),
      upstreamMessage,
      bodyExcerpt,
      method,
      path,
      payload,
    });
  }

  if (parseError) {
    throw new Error(
      `Core API ${method} ${path} returned non-JSON body (status ${response.status}): ${text.slice(0, 200)}`,
    );
  }

  return payload as T;
}

export async function listCoreOrganizations(token: string) {
  const payload = await coreApiRequest("/organisations", { token });
  return getJsonArray(payload).map(normalizeCoreOrganization);
}

export async function getCoreOrganizationById(token: string, orgId: string) {
  const payload = await coreApiRequest(`/organisations/${orgId}`, { token });
  return normalizeCoreOrganization(getJsonObject(payload));
}

export async function createCoreOrganization(
  token: string,
  body: Record<string, unknown>,
) {
  const payload = await coreApiRequest("/organisations", {
    method: "POST",
    token,
    body,
  });
  return normalizeCoreOrganization(getJsonObject(payload));
}

export async function listCoreUsers(token: string) {
  const payload = await coreApiRequest("/users", { token });
  return getJsonArray(payload).map(normalizeCoreUser);
}

export async function createCoreUser(
  token: string,
  body: Record<string, unknown>,
) {
  const payload = await coreApiRequest("/users", {
    method: "POST",
    token,
    body,
  });
  return normalizeCoreUser(getJsonObject(payload));
}

export async function updateCoreUser(
  token: string,
  id: string,
  body: Record<string, unknown>,
) {
  const payload = await coreApiRequest(`/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    token,
    body,
  });
  return normalizeCoreUser(getJsonObject(payload));
}

function normalizeBeneficiary(raw: RawRecord): CoreBeneficiary {
  const userIdRaw = raw.user_id ?? raw.userId;
  const pctRaw = raw.ownership_percentage ?? raw.ownershipPercentage;
  const posRaw = raw.position;

  return {
    id:
      typeof raw.id === "number"
        ? raw.id
        : typeof raw.id === "string"
          ? Number.parseInt(raw.id, 10) || undefined
          : undefined,
    name: toStringValue(raw.name),
    userId: userIdRaw == null ? null : toStringValue(userIdRaw) || null,
    ownershipPercentage:
      typeof pctRaw === "number"
        ? pctRaw
        : Number.parseFloat(toStringValue(pctRaw)) || 0,
    position: typeof posRaw === "number" ? posRaw : undefined,
  };
}

export function normalizeCoreEntity(raw: RawRecord): CoreEntity {
  const beneficiariesRaw = Array.isArray(raw.beneficiaries)
    ? raw.beneficiaries
    : [];

  return {
    id: toStringValue(raw.id),
    orgId: toStringValue(raw.org_id ?? raw.orgId),
    entityType: (toStringValue(
      raw.entity_type ?? raw.entityType,
    ).toLowerCase() || "individual") as EntityType,
    name: toStringValue(raw.name),
    createdFor: toStringValue(raw.created_for ?? raw.createdFor),
    createdBy: toStringValue(raw.created_by ?? raw.createdBy),
    updatedBy:
      raw.updated_by == null && raw.updatedBy == null
        ? null
        : toStringValue(raw.updated_by ?? raw.updatedBy) || null,
    createdAt: toStringValue(raw.created_at ?? raw.createdAt),
    updatedAt: toStringValue(raw.updated_at ?? raw.updatedAt),
    beneficiaries: beneficiariesRaw
      .filter((b): b is RawRecord => typeof b === "object" && b !== null)
      .map(normalizeBeneficiary),
  };
}

export async function listCoreEntities(
  token: string,
  params?: { clientId?: string },
) {
  const query = params?.clientId
    ? `?client_id=${encodeURIComponent(params.clientId)}`
    : "";
  const payload = await coreApiRequest(`/entities${query}`, { token });
  return getJsonArray(payload).map(normalizeCoreEntity);
}

export async function getCoreEntity(token: string, id: string) {
  const payload = await coreApiRequest(`/entities/${encodeURIComponent(id)}`, {
    token,
  });
  return normalizeCoreEntity(getJsonObject(payload));
}

export async function createCoreEntity(
  token: string,
  body: Record<string, unknown>,
) {
  const payload = await coreApiRequest("/entities", {
    method: "POST",
    token,
    body,
  });
  return normalizeCoreEntity(getJsonObject(payload));
}

export async function updateCoreEntity(
  token: string,
  id: string,
  body: Record<string, unknown>,
) {
  const payload = await coreApiRequest(`/entities/${encodeURIComponent(id)}`, {
    method: "PATCH",
    token,
    body,
  });
  return normalizeCoreEntity(getJsonObject(payload));
}

export async function deleteCoreEntity(token: string, id: string) {
  await coreApiRequest(`/entities/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
  });
}

function normalizePropertyOwner(raw: RawRecord): CorePropertyOwner {
  const beneficiaryRaw = raw.entity_beneficiary_id ?? raw.entityBeneficiaryId;
  const userIdRaw = raw.user_id ?? raw.userId;
  const pctRaw = raw.ownership_percentage ?? raw.ownershipPercentage;
  const posRaw = raw.position;

  return {
    id:
      typeof raw.id === "number"
        ? raw.id
        : typeof raw.id === "string"
          ? Number.parseInt(raw.id, 10) || undefined
          : undefined,
    entityBeneficiaryId:
      beneficiaryRaw == null
        ? null
        : typeof beneficiaryRaw === "number"
          ? beneficiaryRaw
          : Number.parseInt(toStringValue(beneficiaryRaw), 10) || null,
    ownerName: toStringValue(raw.owner_name ?? raw.ownerName),
    userId: userIdRaw == null ? null : toStringValue(userIdRaw) || null,
    ownershipPercentage: toFloatValue(pctRaw),
    position: typeof posRaw === "number" ? posRaw : undefined,
  };
}

export function normalizeCoreProperty(raw: RawRecord): CoreProperty {
  const ownersRaw = Array.isArray(raw.owners) ? raw.owners : [];
  const loanRaw = raw.loan_details ?? raw.loanDetails;

  return {
    id: toStringValue(raw.id),
    orgId: toStringValue(raw.org_id ?? raw.orgId),
    entityId: toStringValue(raw.entity_id ?? raw.entityId),
    createdFor: toStringValue(raw.created_for ?? raw.createdFor),
    name: toStringValue(raw.name),
    propertyType: (toStringValue(
      raw.property_type ?? raw.propertyType,
    ).toLowerCase() || "residential") as PropertyType,
    locationText: toStringValue(raw.location_text ?? raw.locationText),
    estimatedMarketValue: toFloatValue(
      raw.estimated_market_value ?? raw.estimatedMarketValue,
    ),
    purchaseDate: toStringValue(raw.purchase_date ?? raw.purchaseDate),
    purchaseAmount: toFloatValue(raw.purchase_amount ?? raw.purchaseAmount),
    hasDepreciationSchedule: Boolean(
      raw.has_depreciation_schedule ?? raw.hasDepreciationSchedule,
    ),
    status: toStringValue(raw.status),
    imageUrl:
      raw.image_url == null && raw.imageUrl == null
        ? null
        : toStringValue(raw.image_url ?? raw.imageUrl) || null,
    loanDetails:
      typeof loanRaw === "object" && loanRaw !== null && !Array.isArray(loanRaw)
        ? (loanRaw as Record<string, unknown>)
        : null,
    createdBy: toStringValue(raw.created_by ?? raw.createdBy),
    updatedBy:
      raw.updated_by == null && raw.updatedBy == null
        ? null
        : toStringValue(raw.updated_by ?? raw.updatedBy) || null,
    createdAt: toStringValue(raw.created_at ?? raw.createdAt),
    updatedAt: toStringValue(raw.updated_at ?? raw.updatedAt),
    owners: ownersRaw
      .filter(
        (owner): owner is RawRecord =>
          typeof owner === "object" && owner !== null,
      )
      .map(normalizePropertyOwner),
  };
}

export async function listCoreProperties(token: string, entityId: string) {
  const payload = await coreApiRequest(
    `/entities/${encodeURIComponent(entityId)}/properties`,
    { token },
  );
  return getJsonArray(payload).map(normalizeCoreProperty);
}

export async function getCoreProperty(token: string, id: string) {
  const payload = await coreApiRequest(
    `/properties/${encodeURIComponent(id)}`,
    {
      token,
    },
  );
  return normalizeCoreProperty(getJsonObject(payload));
}

export async function createCoreProperty(
  token: string,
  entityId: string,
  body: Record<string, unknown>,
) {
  const payload = await coreApiRequest(
    `/entities/${encodeURIComponent(entityId)}/properties`,
    {
      method: "POST",
      token,
      body,
    },
  );
  return normalizeCoreProperty(getJsonObject(payload));
}

export async function updateCoreProperty(
  token: string,
  id: string,
  body: Record<string, unknown>,
) {
  const payload = await coreApiRequest(
    `/properties/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      token,
      body,
    },
  );
  return normalizeCoreProperty(getJsonObject(payload));
}

export async function deleteCoreProperty(token: string, id: string) {
  await coreApiRequest(`/properties/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
  });
}

// =============================================================================
// Transactions
// =============================================================================

export type CoreTransactionType = "revenue" | "expense";
export type CoreReviewStatus = "unreviewed" | "reviewed";
export type CoreAssetClass = "capital_works" | "capital_allowance";

export type CoreTransactionAllocation = {
  id: number;
  propertyOwnerId: number | null;
  ownerName: string;
  ownerUserId: string | null;
  entityBeneficiaryId: number | null;
  ownershipPercentage: number;
  shareGrossAmount: number;
  shareGstAmount: number;
  shareNetAmount: number;
  metadata: Record<string, unknown>;
};

export type CoreTransactionSplit = {
  id: number;
  propertyId: string;
  propertyName: string;
  splitPercentage: number;
  splitGrossAmount: number;
  splitGstAmount: number;
  splitNetAmount: number;
  metadata: Record<string, unknown>;
  allocations: CoreTransactionAllocation[];
};

export type CoreTransactionDetail = {
  id: string;
  orgId: string;
  entityId: string;
  entityName: string;
  type: CoreTransactionType;
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
  assetClass: CoreAssetClass | null;
  effectiveLifeYears: number | null;
  ruleId: number | null;
  reviewStatus: CoreReviewStatus;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  splits: CoreTransactionSplit[];
};

export type CoreTransactionListItem = {
  id: string;
  type: CoreTransactionType;
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
  assetClass: CoreAssetClass | null;
  effectiveLifeYears: number | null;
  ruleId: number | null;
  reviewStatus: CoreReviewStatus;
  entityId: string;
  entityName: string;
  propertyIds: string[];
  propertyNames: string[];
  clientShareGross: number | null;
  clientShareGst: number | null;
  clientShareNet: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CorePropertyTransactionRow = {
  transactionId: string;
  transactionType: CoreTransactionType;
  categoryId: number;
  categoryName: string;
  subcategoryId: number;
  subcategoryName: string;
  invoiceDate: string;
  description: string | null;
  transactionGrossAmount: number;
  transactionGstAmount: number;
  transactionNetAmount: number;
  isAssetPurchase: boolean;
  ruleId: number | null;
  reviewStatus: CoreReviewStatus;
  splitId: number;
  splitPercentage: number;
  splitGrossAmount: number;
  splitGstAmount: number;
  splitNetAmount: number;
};

export type CoreTransactionCategory = {
  id: number;
  name: string;
  type: CoreTransactionType;
  isSystem: boolean;
  metadata: Record<string, unknown>;
};

export type CoreTransactionSubcategory = {
  id: number;
  categoryId: number;
  name: string;
  isSystem: boolean;
  metadata: Record<string, unknown>;
};

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => toStringValue(v)).filter((s) => s.length > 0);
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  return toFloatValue(value);
}

function toNullableString(value: unknown): string | null {
  if (value == null) return null;
  const s = toStringValue(value);
  return s === "" ? null : s;
}

function toNullableInt(value: unknown): number | null {
  if (value == null) return null;
  const parsed = toNumberValue(value);
  return parsed;
}

function toAssetClass(value: unknown): CoreAssetClass | null {
  const s = toNullableString(value);
  if (s === "capital_works" || s === "capital_allowance") return s;
  return null;
}

function toTxnType(value: unknown): CoreTransactionType {
  const s = toStringValue(value).toLowerCase();
  return s === "revenue" ? "revenue" : "expense";
}

function toReviewStatus(value: unknown): CoreReviewStatus {
  const s = toStringValue(value).toLowerCase();
  return s === "reviewed" ? "reviewed" : "unreviewed";
}

export function normalizeCoreTransactionAllocation(
  raw: RawRecord,
): CoreTransactionAllocation {
  return {
    id: toNumberValue(raw.id) ?? 0,
    propertyOwnerId: toNullableInt(raw.property_owner_id ?? raw.propertyOwnerId),
    ownerName: toStringValue(raw.owner_name ?? raw.ownerName),
    ownerUserId: toNullableString(raw.owner_user_id ?? raw.ownerUserId),
    entityBeneficiaryId: toNullableInt(
      raw.entity_beneficiary_id ?? raw.entityBeneficiaryId,
    ),
    ownershipPercentage: toFloatValue(
      raw.ownership_percentage ?? raw.ownershipPercentage,
    ),
    shareGrossAmount: toFloatValue(
      raw.share_gross_amount ?? raw.shareGrossAmount,
    ),
    shareGstAmount: toFloatValue(raw.share_gst_amount ?? raw.shareGstAmount),
    shareNetAmount: toFloatValue(raw.share_net_amount ?? raw.shareNetAmount),
    metadata: toRecord(raw.metadata),
  };
}

export function normalizeCoreTransactionSplit(
  raw: RawRecord,
): CoreTransactionSplit {
  const allocationsRaw = Array.isArray(raw.allocations) ? raw.allocations : [];
  return {
    id: toNumberValue(raw.id) ?? 0,
    propertyId: toStringValue(raw.property_id ?? raw.propertyId),
    propertyName: toStringValue(raw.property_name ?? raw.propertyName),
    splitPercentage: toFloatValue(raw.split_percentage ?? raw.splitPercentage),
    splitGrossAmount: toFloatValue(
      raw.split_gross_amount ?? raw.splitGrossAmount,
    ),
    splitGstAmount: toFloatValue(raw.split_gst_amount ?? raw.splitGstAmount),
    splitNetAmount: toFloatValue(raw.split_net_amount ?? raw.splitNetAmount),
    metadata: toRecord(raw.metadata),
    allocations: allocationsRaw
      .filter((a): a is RawRecord => typeof a === "object" && a !== null)
      .map(normalizeCoreTransactionAllocation),
  };
}

export function normalizeCoreTransactionDetail(
  raw: RawRecord,
): CoreTransactionDetail {
  const splitsRaw = Array.isArray(raw.splits) ? raw.splits : [];
  return {
    id: toStringValue(raw.id),
    orgId: toStringValue(raw.org_id ?? raw.orgId),
    entityId: toStringValue(raw.entity_id ?? raw.entityId),
    entityName: toStringValue(raw.entity_name ?? raw.entityName),
    type: toTxnType(raw.type),
    categoryId: toNumberValue(raw.category_id ?? raw.categoryId) ?? 0,
    categoryName: toStringValue(raw.category_name ?? raw.categoryName),
    subcategoryId: toNumberValue(raw.subcategory_id ?? raw.subcategoryId) ?? 0,
    subcategoryName: toStringValue(raw.subcategory_name ?? raw.subcategoryName),
    invoiceDate: toStringValue(raw.invoice_date ?? raw.invoiceDate),
    grossAmount: toFloatValue(raw.gross_amount ?? raw.grossAmount),
    gstAmount: toFloatValue(raw.gst_amount ?? raw.gstAmount),
    netAmount: toFloatValue(raw.net_amount ?? raw.netAmount),
    description: toNullableString(raw.description),
    internalRemarks: toNullableString(
      raw.internal_remarks ?? raw.internalRemarks,
    ),
    isAssetPurchase: Boolean(raw.is_asset_purchase ?? raw.isAssetPurchase),
    assetClass: toAssetClass(raw.asset_class ?? raw.assetClass),
    effectiveLifeYears: toNullableNumber(
      raw.effective_life_years ?? raw.effectiveLifeYears,
    ),
    ruleId: toNullableInt(raw.rule_id ?? raw.ruleId),
    reviewStatus: toReviewStatus(raw.review_status ?? raw.reviewStatus),
    metadata: toRecord(raw.metadata),
    createdBy: toStringValue(raw.created_by ?? raw.createdBy),
    updatedBy: toNullableString(raw.updated_by ?? raw.updatedBy),
    isDeleted: Boolean(raw.is_deleted ?? raw.isDeleted),
    createdAt: toStringValue(raw.created_at ?? raw.createdAt),
    updatedAt: toStringValue(raw.updated_at ?? raw.updatedAt),
    splits: splitsRaw
      .filter((s): s is RawRecord => typeof s === "object" && s !== null)
      .map(normalizeCoreTransactionSplit),
  };
}

export function normalizeCoreTransactionListItem(
  raw: RawRecord,
): CoreTransactionListItem {
  return {
    id: toStringValue(raw.id),
    type: toTxnType(raw.type),
    categoryId: toNumberValue(raw.category_id ?? raw.categoryId) ?? 0,
    categoryName: toStringValue(raw.category_name ?? raw.categoryName),
    subcategoryId: toNumberValue(raw.subcategory_id ?? raw.subcategoryId) ?? 0,
    subcategoryName: toStringValue(raw.subcategory_name ?? raw.subcategoryName),
    invoiceDate: toStringValue(raw.invoice_date ?? raw.invoiceDate),
    grossAmount: toFloatValue(raw.gross_amount ?? raw.grossAmount),
    gstAmount: toFloatValue(raw.gst_amount ?? raw.gstAmount),
    netAmount: toFloatValue(raw.net_amount ?? raw.netAmount),
    description: toNullableString(raw.description),
    internalRemarks: toNullableString(
      raw.internal_remarks ?? raw.internalRemarks,
    ),
    isAssetPurchase: Boolean(raw.is_asset_purchase ?? raw.isAssetPurchase),
    assetClass: toAssetClass(raw.asset_class ?? raw.assetClass),
    effectiveLifeYears: toNullableNumber(
      raw.effective_life_years ?? raw.effectiveLifeYears,
    ),
    ruleId: toNullableInt(raw.rule_id ?? raw.ruleId),
    reviewStatus: toReviewStatus(raw.review_status ?? raw.reviewStatus),
    entityId: toStringValue(raw.entity_id ?? raw.entityId),
    entityName: toStringValue(raw.entity_name ?? raw.entityName),
    propertyIds: toStringArray(raw.property_ids ?? raw.propertyIds),
    propertyNames: toStringArray(raw.property_names ?? raw.propertyNames),
    clientShareGross: toNullableNumber(
      raw.client_share_gross ?? raw.clientShareGross,
    ),
    clientShareGst: toNullableNumber(
      raw.client_share_gst ?? raw.clientShareGst,
    ),
    clientShareNet: toNullableNumber(
      raw.client_share_net ?? raw.clientShareNet,
    ),
    metadata: toRecord(raw.metadata),
    createdAt: toStringValue(raw.created_at ?? raw.createdAt),
    updatedAt: toStringValue(raw.updated_at ?? raw.updatedAt),
  };
}

export function normalizeCorePropertyTransactionRow(
  raw: RawRecord,
): CorePropertyTransactionRow {
  return {
    transactionId: toStringValue(raw.transaction_id ?? raw.transactionId),
    transactionType: toTxnType(raw.transaction_type ?? raw.transactionType),
    categoryId: toNumberValue(raw.category_id ?? raw.categoryId) ?? 0,
    categoryName: toStringValue(raw.category_name ?? raw.categoryName),
    subcategoryId: toNumberValue(raw.subcategory_id ?? raw.subcategoryId) ?? 0,
    subcategoryName: toStringValue(raw.subcategory_name ?? raw.subcategoryName),
    invoiceDate: toStringValue(raw.invoice_date ?? raw.invoiceDate),
    description: toNullableString(raw.description),
    transactionGrossAmount: toFloatValue(
      raw.transaction_gross_amount ?? raw.transactionGrossAmount,
    ),
    transactionGstAmount: toFloatValue(
      raw.transaction_gst_amount ?? raw.transactionGstAmount,
    ),
    transactionNetAmount: toFloatValue(
      raw.transaction_net_amount ?? raw.transactionNetAmount,
    ),
    isAssetPurchase: Boolean(raw.is_asset_purchase ?? raw.isAssetPurchase),
    ruleId: toNullableInt(raw.rule_id ?? raw.ruleId),
    reviewStatus: toReviewStatus(raw.review_status ?? raw.reviewStatus),
    splitId: toNumberValue(raw.split_id ?? raw.splitId) ?? 0,
    splitPercentage: toFloatValue(raw.split_percentage ?? raw.splitPercentage),
    splitGrossAmount: toFloatValue(
      raw.split_gross_amount ?? raw.splitGrossAmount,
    ),
    splitGstAmount: toFloatValue(raw.split_gst_amount ?? raw.splitGstAmount),
    splitNetAmount: toFloatValue(raw.split_net_amount ?? raw.splitNetAmount),
  };
}

export function normalizeCoreTransactionCategory(
  raw: RawRecord,
): CoreTransactionCategory {
  return {
    id: toNumberValue(raw.id) ?? 0,
    name: toStringValue(raw.name),
    type: toTxnType(raw.type),
    isSystem: Boolean(raw.is_system ?? raw.isSystem),
    metadata: toRecord(raw.metadata),
  };
}

export function normalizeCoreTransactionSubcategory(
  raw: RawRecord,
): CoreTransactionSubcategory {
  return {
    id: toNumberValue(raw.id) ?? 0,
    categoryId: toNumberValue(raw.category_id ?? raw.categoryId) ?? 0,
    name: toStringValue(raw.name),
    isSystem: Boolean(raw.is_system ?? raw.isSystem),
    metadata: toRecord(raw.metadata),
  };
}

export async function listCoreTransactionsByClient(
  token: string,
  clientId: string,
) {
  const payload = await coreApiRequest(
    `/clients/${encodeURIComponent(clientId)}/transactions`,
    { token },
  );
  return getJsonArray(payload).map(normalizeCoreTransactionListItem);
}

export async function listCoreTransactionsByEntity(
  token: string,
  entityId: string,
) {
  const payload = await coreApiRequest(
    `/entities/${encodeURIComponent(entityId)}/transactions`,
    { token },
  );
  return getJsonArray(payload).map(normalizeCoreTransactionListItem);
}

export async function listCoreTransactionsByProperty(
  token: string,
  propertyId: string,
) {
  const payload = await coreApiRequest(
    `/properties/${encodeURIComponent(propertyId)}/transactions`,
    { token },
  );
  return getJsonArray(payload).map(normalizeCorePropertyTransactionRow);
}

export async function getCoreTransaction(token: string, id: string) {
  const payload = await coreApiRequest(
    `/transactions/${encodeURIComponent(id)}`,
    { token },
  );
  return normalizeCoreTransactionDetail(getJsonObject(payload));
}

export async function createCoreTransactionForEntity(
  token: string,
  entityId: string,
  body: Record<string, unknown>,
) {
  const payload = await coreApiRequest(
    `/entities/${encodeURIComponent(entityId)}/transactions`,
    { method: "POST", token, body },
  );
  return normalizeCoreTransactionDetail(getJsonObject(payload));
}

export async function updateCoreTransaction(
  token: string,
  id: string,
  body: Record<string, unknown>,
) {
  const payload = await coreApiRequest(
    `/transactions/${encodeURIComponent(id)}`,
    { method: "PATCH", token, body },
  );
  return normalizeCoreTransactionDetail(getJsonObject(payload));
}

export async function listCoreTransactionCategories(
  token: string,
  type?: CoreTransactionType,
) {
  const query = type ? `?type=${encodeURIComponent(type)}` : "";
  const payload = await coreApiRequest(`/transactions/categories${query}`, {
    token,
  });
  return getJsonArray(payload).map(normalizeCoreTransactionCategory);
}

export async function listCoreTransactionSubcategories(
  token: string,
  categoryId: number,
) {
  const payload = await coreApiRequest(
    `/transactions/categories/${encodeURIComponent(categoryId)}/sub-categories`,
    { token },
  );
  return getJsonArray(payload).map(normalizeCoreTransactionSubcategory);
}
