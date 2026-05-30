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
  reconciled: boolean;
  reconciledAt: string | null;
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
  settlementDate?: string;
  purchaseAmount: number;
  hasDepreciationSchedule: boolean;
  status: string;
  imageUrl: string | null;
  loanDetails: Record<string, unknown> | null;
  reconciled: boolean;
  reconciledAt: string | null;
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
    reconciled: Boolean(raw.reconciled ?? false),
    reconciledAt: raw.reconciled_at != null ? toStringValue(raw.reconciled_at) : null,
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
    settlementDate: toStringValue(raw.settlement_date ?? raw.settlementDate),
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
    reconciled: Boolean(raw.reconciled ?? false),
    reconciledAt:
      raw.reconciled_at == null && raw.reconciledAt == null
        ? null
        : toStringValue(raw.reconciled_at ?? raw.reconciledAt) || null,
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

export type CoreLogitData = Record<string, unknown>;

export async function getCorePropertyLogit(
  token: string,
  id: string,
): Promise<CoreLogitData> {
  const payload = await coreApiRequest(
    `/properties/${encodeURIComponent(id)}/logit`,
    { token },
  );
  const obj = getJsonObject(payload);
  const ld = obj.logit_data ?? obj.logitData;
  return typeof ld === "object" && ld !== null && !Array.isArray(ld)
    ? (ld as CoreLogitData)
    : {};
}

export async function updateCorePropertyLogit(
  token: string,
  id: string,
  logitData: CoreLogitData,
): Promise<CoreLogitData> {
  const payload = await coreApiRequest(
    `/properties/${encodeURIComponent(id)}/logit`,
    { method: "PATCH", token, body: { logit_data: logitData } },
  );
  const obj = getJsonObject(payload);
  const ld = obj.logit_data ?? obj.logitData;
  return typeof ld === "object" && ld !== null && !Array.isArray(ld)
    ? (ld as CoreLogitData)
    : {};
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
  documentId: string | null;
  documentFileName: string | null;
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
  clientId: string;
  clientName: string;
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
    documentId: toNullableString(raw.document_id ?? raw.documentId),
    documentFileName: toNullableString(raw.document_file_name ?? raw.documentFileName),
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
    clientId: toStringValue(
      raw.client_id ?? raw.clientId ?? raw.created_for ?? raw.createdFor,
    ),
    clientName: toStringValue(
      raw.client_name ??
        raw.clientName ??
        raw.created_for_name ??
        raw.createdForName,
    ),
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

export async function deleteCoreTransaction(token: string, id: string) {
  await coreApiRequest(`/transactions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
  });
}

// ── Bank Reconciliation ───────────────────────────────────────────────────────

export type ReconciliationTransaction = {
  date: string;
  description: string;
  payee: string | null;
  debit: number | null;
  credit: number | null;
  balance: number | null;
};

export type ReconciliationAccount = {
  bank: string;
  accountNumber: string;
  accountType: string;
  holder: string;
  statementPeriod: { from: string; to: string };
  openingBalance: number;
  closingBalance: number;
};

export type ReconciliationSummary = {
  totalTransactions: number;
  totalDebits: number;
  totalCredits: number;
  pagesProcessed: number;
  pagesSkipped: number;
  processingTimeSeconds: number;
};

export type ReconciliationListItem = {
  id: string;
  status: string;
  totalPages: number | null;
  failedPages: number[] | null;
  summary: ReconciliationSummary | null;
  createdAt: string;
  updatedAt: string;
};

export type ReconciliationDetail = ReconciliationListItem & {
  account: ReconciliationAccount | null;
  transactions: ReconciliationTransaction[];
  errorMessage: string | null;
};

export type ReconciliationMatch = {
  id: string;
  reconciliationId: string;
  bankTxIndex: number;
  transactionId: string | null;
  status: "confirmed" | "excluded";
  confirmedBy: string;
  confirmedAt: string;
};

function normalizeReconciliationSummary(raw: RawRecord): ReconciliationSummary {
  return {
    totalTransactions: Number(raw.total_transactions ?? raw.totalTransactions ?? 0),
    totalDebits: Number(raw.total_debits ?? raw.totalDebits ?? 0),
    totalCredits: Number(raw.total_credits ?? raw.totalCredits ?? 0),
    pagesProcessed: Number(raw.pages_processed ?? raw.pagesProcessed ?? 0),
    pagesSkipped: Number(raw.pages_skipped ?? raw.pagesSkipped ?? 0),
    processingTimeSeconds: Number(raw.processing_time_seconds ?? raw.processingTimeSeconds ?? 0),
  };
}

function normalizeReconciliationAccount(raw: RawRecord): ReconciliationAccount {
  const period = (raw.statement_period ?? raw.statementPeriod ?? {}) as RawRecord;
  return {
    bank: String(raw.bank ?? ""),
    accountNumber: String(raw.account_number ?? raw.accountNumber ?? ""),
    accountType: String(raw.account_type ?? raw.accountType ?? ""),
    holder: String(raw.holder ?? ""),
    statementPeriod: {
      from: String(period.from ?? ""),
      to: String(period.to ?? ""),
    },
    openingBalance: Number(raw.opening_balance ?? raw.openingBalance ?? 0),
    closingBalance: Number(raw.closing_balance ?? raw.closingBalance ?? 0),
  };
}

function normalizeReconciliationListItem(raw: RawRecord): ReconciliationListItem {
  const summaryRaw = raw.summary as RawRecord | null;
  return {
    id: String(raw.id ?? ""),
    status: String(raw.status ?? ""),
    totalPages: raw.total_pages != null ? Number(raw.total_pages) : null,
    failedPages: Array.isArray(raw.failed_pages) ? (raw.failed_pages as number[]) : null,
    summary: summaryRaw ? normalizeReconciliationSummary(summaryRaw) : null,
    createdAt: String(raw.created_at ?? ""),
    updatedAt: String(raw.updated_at ?? ""),
  };
}

export async function startReconciliation(
  token: string,
  s3Key: string,
  entityId: string,
  sessionId: string,
): Promise<{ jobId: string }> {
  const payload = await coreApiRequest<{ job_id: string }>(
    `/api/reconciliation`,
    {
      method: "POST",
      token,
      body: { s3_key: s3Key, entity_id: entityId, session_id: sessionId },
    },
  );
  return { jobId: (payload as { job_id: string }).job_id };
}

export async function listReconciliations(
  token: string,
  entityId: string,
): Promise<ReconciliationListItem[]> {
  const payload = await coreApiRequest(
    `/api/entities/${encodeURIComponent(entityId)}/reconciliations`,
    { token },
  );
  return getJsonArray(payload).map((r) =>
    normalizeReconciliationListItem(r as RawRecord),
  );
}

export async function getReconciliation(
  token: string,
  entityId: string,
  reconciliationId: string,
): Promise<ReconciliationDetail> {
  const payload = await coreApiRequest(
    `/api/entities/${encodeURIComponent(entityId)}/reconciliations/${encodeURIComponent(reconciliationId)}`,
    { token },
  ) as RawRecord;

  const base = normalizeReconciliationListItem(payload);
  const accountRaw = payload.account as RawRecord | null;
  const txRaw = Array.isArray(payload.transactions) ? payload.transactions as RawRecord[] : [];

  return {
    ...base,
    account: accountRaw ? normalizeReconciliationAccount(accountRaw) : null,
    transactions: txRaw.map((t) => ({
      date: String(t.date ?? ""),
      description: String(t.description ?? ""),
      payee: t.payee != null ? String(t.payee) : null,
      debit: t.debit != null ? Number(t.debit) : null,
      credit: t.credit != null ? Number(t.credit) : null,
      balance: t.balance != null ? Number(t.balance) : null,
    })),
    errorMessage: payload.error_message != null ? String(payload.error_message) : null,
  };
}

function normalizeReconciliationMatch(raw: RawRecord): ReconciliationMatch {
  return {
    id: String(raw.id ?? ""),
    reconciliationId: String(raw.reconciliation_id ?? raw.reconciliationId ?? ""),
    bankTxIndex: Number(raw.bank_tx_index ?? raw.bankTxIndex ?? 0),
    transactionId: raw.transaction_id != null ? String(raw.transaction_id) : null,
    status: raw.status === "excluded" ? "excluded" : "confirmed",
    confirmedBy: String(raw.confirmed_by ?? raw.confirmedBy ?? ""),
    confirmedAt: String(raw.confirmed_at ?? raw.confirmedAt ?? ""),
  };
}

export async function listReconciliationMatches(
  token: string,
  entityId: string,
  reconciliationId: string,
): Promise<ReconciliationMatch[]> {
  const payload = await coreApiRequest(
    `/api/entities/${encodeURIComponent(entityId)}/reconciliations/${encodeURIComponent(reconciliationId)}/matches`,
    { token },
  );
  return getJsonArray(payload).map((r) => normalizeReconciliationMatch(r as RawRecord));
}

export async function createReconciliationMatch(
  token: string,
  entityId: string,
  reconciliationId: string,
  body: { bankTxIndex: number; transactionId: string | null; status: "confirmed" | "excluded" },
): Promise<ReconciliationMatch> {
  const payload = await coreApiRequest(
    `/api/entities/${encodeURIComponent(entityId)}/reconciliations/${encodeURIComponent(reconciliationId)}/matches`,
    {
      method: "POST",
      token,
      body: {
        bank_tx_index: body.bankTxIndex,
        transaction_id: body.transactionId,
        status: body.status,
      },
    },
  );
  return normalizeReconciliationMatch(getJsonObject(payload) as RawRecord);
}

export async function sendInviteEmail(
  token: string,
  body: { email: string; role: string; invite_link: string },
): Promise<void> {
  await coreApiRequest("/invitations/email", { method: "POST", token, body });
}

export async function deleteReconciliationMatch(
  token: string,
  entityId: string,
  reconciliationId: string,
  bankTxIndex: number,
): Promise<void> {
  await coreApiRequest(
    `/api/entities/${encodeURIComponent(entityId)}/reconciliations/${encodeURIComponent(reconciliationId)}/matches?bankTxIndex=${bankTxIndex}`,
    { method: "DELETE", token },
  );
}

// ── Reconciliation sessions ──────────────────────────────────────────────────

export type ReconciliationSessionStatus = "open" | "completed";

export type ReconciliationSession = {
  id: string;
  entityId: string;
  label: string;
  periodFrom: string | null;
  periodTo: string | null;
  status: ReconciliationSessionStatus;
  statementCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type ReconciliationSessionDetail = ReconciliationSession & {
  statements: ReconciliationListItem[];
};

function normalizeReconciliationSession(raw: RawRecord): ReconciliationSession {
  const status = raw.status === "completed" ? "completed" : "open";
  return {
    id: String(raw.id ?? ""),
    entityId: String(raw.entity_id ?? raw.entityId ?? ""),
    label: String(raw.label ?? ""),
    periodFrom: raw.period_from != null ? String(raw.period_from) : null,
    periodTo: raw.period_to != null ? String(raw.period_to) : null,
    status,
    statementCount: Number(raw.statement_count ?? raw.statementCount ?? 0),
    createdAt: String(raw.created_at ?? raw.createdAt ?? ""),
    updatedAt: String(raw.updated_at ?? raw.updatedAt ?? ""),
    completedAt: raw.completed_at != null ? String(raw.completed_at) : null,
  };
}

export async function listReconciliationSessions(
  token: string,
  entityId: string,
): Promise<ReconciliationSession[]> {
  const payload = await coreApiRequest(
    `/api/entities/${encodeURIComponent(entityId)}/reconciliation-sessions`,
    { token },
  );
  return getJsonArray(payload).map((r) =>
    normalizeReconciliationSession(r as RawRecord),
  );
}

export async function createReconciliationSession(
  token: string,
  entityId: string,
  body: { label: string; periodFrom?: string | null; periodTo?: string | null },
): Promise<ReconciliationSession> {
  const payload = await coreApiRequest(
    `/api/entities/${encodeURIComponent(entityId)}/reconciliation-sessions`,
    {
      method: "POST",
      token,
      body: {
        label: body.label,
        period_from: body.periodFrom ?? null,
        period_to: body.periodTo ?? null,
      },
    },
  );
  return normalizeReconciliationSession(getJsonObject(payload) as RawRecord);
}

export async function getReconciliationSession(
  token: string,
  entityId: string,
  sessionId: string,
): Promise<ReconciliationSessionDetail> {
  const payload = (await coreApiRequest(
    `/api/entities/${encodeURIComponent(entityId)}/reconciliation-sessions/${encodeURIComponent(sessionId)}`,
    { token },
  )) as RawRecord;
  const base = normalizeReconciliationSession(payload);
  const statementsRaw = Array.isArray(payload.statements)
    ? (payload.statements as RawRecord[])
    : [];
  return {
    ...base,
    statements: statementsRaw.map(normalizeReconciliationListItem),
  };
}

export async function updateReconciliationSession(
  token: string,
  entityId: string,
  sessionId: string,
  body: {
    label?: string;
    periodFrom?: string | null;
    periodTo?: string | null;
    status?: ReconciliationSessionStatus;
  },
): Promise<ReconciliationSession> {
  const reqBody: Record<string, unknown> = {};
  if (body.label !== undefined) reqBody.label = body.label;
  if (body.periodFrom !== undefined) reqBody.period_from = body.periodFrom;
  if (body.periodTo !== undefined) reqBody.period_to = body.periodTo;
  if (body.status !== undefined) reqBody.status = body.status;
  const payload = await coreApiRequest(
    `/api/entities/${encodeURIComponent(entityId)}/reconciliation-sessions/${encodeURIComponent(sessionId)}`,
    { method: "PATCH", token, body: reqBody },
  );
  return normalizeReconciliationSession(getJsonObject(payload) as RawRecord);
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
