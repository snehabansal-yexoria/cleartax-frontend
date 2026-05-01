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
  status: string;
  phoneNumber: string;
  invitedBy: string;
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

export function normalizeCoreUser(raw: RawRecord): CoreUser {
  return {
    id: toStringValue(raw.id || raw.user_id || raw.userId),
    email: toStringValue(raw.email),
    fullName: toStringValue(raw.full_name || raw.fullName),
    role: getRoleName(raw),
    roleId: toNumberValue(raw.role_id || raw.roleId),
    orgId: toStringValue(raw.org_id || raw.organization_id || raw.orgId),
    status: toStringValue(
      raw.status || (raw.is_active === false ? "INACTIVE" : "ACTIVE"),
    ),
    phoneNumber: toStringValue(
      raw.phone || raw.phone_number || raw.phoneNumber,
    ),
    invitedBy: toStringValue(raw.invited_by || raw.invitedBy || raw.created_by),
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
      (payload as RawRecord | null)?.message ||
      (payload as RawRecord | null)?.error;
    const bodyExcerpt = parseError
      ? text.slice(0, 200).replace(/\s+/g, " ").trim()
      : "";
    throw new Error(
      `Core API ${method} ${path} failed (${response.status} ${response.statusText})${
        upstreamMessage ? `: ${upstreamMessage}` : ""
      }${bodyExcerpt ? ` — body: ${bodyExcerpt}` : ""}`,
    );
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
