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
  enabled: boolean;
  reconciled: boolean;
  reconciledAt: string | null;
  trustType?: string;
  propertiesCount: number;
  transactionsCount: number;
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
  enabled: boolean;
  reconciled: boolean;
  reconciledAt: string | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  owners: CorePropertyOwner[];
};

export type CoreTaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export type CoreTaskPerson = {
  id: string;
  name: string;
};

export type CoreTask = {
  id: string;
  orgId: string;
  name: string;
  description: string;
  assignedBy: CoreTaskPerson;
  assignedTo: CoreTaskPerson;
  deadline: string;
  status: CoreTaskStatus;
  actionFeedback: string | null;
  completedAt: string | null;
  // Derived per caller by the backend: "my" (caller is assignee) or
  // "assigned" (caller is assigner).
  type: "my" | "assigned";
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
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

export interface CoreClient {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  status: string;
  joinedAt: string;
  assignedAccountantId: string | null;
  assignedAccountantName: string | null;
  invitedByEmail: string;
  propertiesCount: number;
  totalMarketValue: number;
  isAssignedToCurrentAccountant: boolean;
  isAssignedToAnotherAccountant: boolean;
}

function normalizeCoreClient(raw: RawRecord): CoreClient {
  const assignedId = raw.assigned_accountant_id ?? raw.assignedAccountantId;
  const assignedName = raw.assigned_accountant_name ?? raw.assignedAccountantName;

  return {
    id: toStringValue(raw.id),
    email: toStringValue(raw.email),
    fullName: toStringValue(raw.full_name ?? raw.fullName),
    phoneNumber: toStringValue(raw.phone_number ?? raw.phoneNumber),
    status: toStringValue(raw.status),
    joinedAt: toStringValue(raw.joined_at ?? raw.joinedAt),
    assignedAccountantId: assignedId == null ? null : toStringValue(assignedId) || null,
    assignedAccountantName:
      assignedName == null ? null : toStringValue(assignedName) || null,
    invitedByEmail: toStringValue(raw.invited_by_email ?? raw.invitedByEmail),
    propertiesCount: toNumberValue(raw.properties_count ?? raw.propertiesCount) ?? 0,
    totalMarketValue: toFloatValue(raw.total_market_value ?? raw.totalMarketValue),
    isAssignedToCurrentAccountant: Boolean(
      raw.is_assigned_to_current_accountant ?? raw.isAssignedToCurrentAccountant,
    ),
    isAssignedToAnotherAccountant: Boolean(
      raw.is_assigned_to_another_accountant ?? raw.isAssignedToAnotherAccountant,
    ),
  };
}

// Server-side aggregate of org clients with property counts/values — replaces
// the per-client entities + per-entity properties fan-out.
export async function listCoreClients(
  token: string,
  params?: { scope?: "mine" | "all" },
) {
  const query = params?.scope === "mine" ? "?scope=mine" : "";
  const payload = await coreApiRequest(`/clients${query}`, { token });
  return getJsonArray(payload).map(normalizeCoreClient);
}

// Single enriched client by id — lets the detail page avoid pulling the whole
// client list to find one row.
export async function getCoreClient(token: string, id: string) {
  const payload = await coreApiRequest(
    `/clients/${encodeURIComponent(id)}`,
    { token },
  );
  return normalizeCoreClient(getJsonObject(payload));
}

// Dashboard stat-card numbers (counts/totals only — no client list).
export interface CoreAccountantSummary {
  pendingInvitations: number;
  registeredClients: number;
  managedClients: number;
  totalProperties: number;
  totalMarketValue: number;
}

export async function getCoreAccountantSummary(
  token: string,
): Promise<CoreAccountantSummary> {
  const raw = getJsonObject(await coreApiRequest("/accountant/summary", { token }));
  return {
    pendingInvitations: toNumberValue(raw.pending_invitations) ?? 0,
    registeredClients: toNumberValue(raw.registered_clients) ?? 0,
    managedClients: toNumberValue(raw.managed_clients) ?? 0,
    totalProperties: toNumberValue(raw.total_properties) ?? 0,
    totalMarketValue: toFloatValue(raw.total_market_value),
  };
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
    // Default true so a backend that predates the enabled column doesn't
    // render everything as disabled.
    enabled: raw.enabled == null ? true : Boolean(raw.enabled),
    reconciled: Boolean(raw.reconciled ?? false),
    reconciledAt: raw.reconciled_at != null ? toStringValue(raw.reconciled_at) : null,
    trustType: raw.trust_type != null ? toStringValue(raw.trust_type) : undefined,
    propertiesCount: toNumberValue(raw.properties_count ?? raw.propertiesCount) ?? 0,
    transactionsCount: toNumberValue(raw.transactions_count ?? raw.transactionsCount) ?? 0,
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

function normalizeCoreTaskPerson(raw: unknown): CoreTaskPerson {
  if (typeof raw !== "object" || raw === null) {
    return { id: toStringValue(raw), name: "" };
  }
  const record = raw as RawRecord;
  return {
    id: toStringValue(record.id),
    name: toStringValue(record.name),
  };
}

export function normalizeCoreTask(raw: RawRecord): CoreTask {
  return {
    id: toStringValue(raw.id),
    orgId: toStringValue(raw.org_id ?? raw.orgId),
    name: toStringValue(raw.name),
    description: toStringValue(raw.description),
    assignedBy: normalizeCoreTaskPerson(raw.assigned_by ?? raw.assignedBy),
    assignedTo: normalizeCoreTaskPerson(raw.assigned_to ?? raw.assignedTo),
    deadline: toStringValue(raw.deadline),
    status: (toStringValue(raw.status).toLowerCase() ||
      "pending") as CoreTaskStatus,
    actionFeedback:
      raw.action_feedback == null && raw.actionFeedback == null
        ? null
        : toStringValue(raw.action_feedback ?? raw.actionFeedback) || null,
    completedAt:
      raw.completed_at == null && raw.completedAt == null
        ? null
        : toStringValue(raw.completed_at ?? raw.completedAt) || null,
    type: toStringValue(raw.type) === "assigned" ? "assigned" : "my",
    createdBy: toStringValue(raw.created_by ?? raw.createdBy),
    updatedBy:
      raw.updated_by == null && raw.updatedBy == null
        ? null
        : toStringValue(raw.updated_by ?? raw.updatedBy) || null,
    createdAt: toStringValue(raw.created_at ?? raw.createdAt),
    updatedAt: toStringValue(raw.updated_at ?? raw.updatedAt),
  };
}

export async function listCoreTasks(
  token: string,
  params?: { type?: string; status?: string },
) {
  const query = new URLSearchParams();
  if (params?.type) query.set("type", params.type);
  if (params?.status) query.set("status", params.status);
  const qs = query.toString();
  const payload = await coreApiRequest(`/tasks${qs ? `?${qs}` : ""}`, { token });
  return getJsonArray(payload).map(normalizeCoreTask);
}

export async function createCoreTask(
  token: string,
  body: Record<string, unknown>,
) {
  const payload = await coreApiRequest("/tasks", {
    method: "POST",
    token,
    body,
  });
  return normalizeCoreTask(getJsonObject(payload));
}

export async function updateCoreTask(
  token: string,
  id: string,
  body: Record<string, unknown>,
) {
  const payload = await coreApiRequest(`/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    token,
    body,
  });
  return normalizeCoreTask(getJsonObject(payload));
}

export async function deleteCoreTask(token: string, id: string) {
  await coreApiRequest(`/tasks/${encodeURIComponent(id)}`, {
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
    enabled: raw.enabled == null ? true : Boolean(raw.enabled),
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

// "personal" (wholly private spending) and "cost_base" (capitalised against a
// property's CGT cost base) are money out but are not deductible expenses, so
// they are distinct types rather than flags on an expense.
export type CoreTransactionType =
  | "revenue"
  | "expense"
  | "personal"
  | "cost_base";
// "active" is the default for every new transaction — live in the ledger, in
// nobody's queue. "unreviewed" means a client pressed "Submit to accountant"
// and it is waiting for sign-off, so it is the accountant's review queue.
export type CoreReviewStatus =
  | "active"
  | "unreviewed"
  | "reviewed"
  | "approved"
  | "rejected";
export type CoreReviewAction = "approve" | "reject" | "reset";
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

/**
 * One side of a private-use split, nested on its parent's detail response.
 *
 * A partly-private expense is stored as three rows: a parent holding the full
 * bill, a business child that is deductible, and a personal child that is not.
 * The grid only ever shows the parent — these are what the detail view expands
 * underneath it.
 */
export type CoreTransactionChild = {
  id: string;
  type: CoreTransactionType;
  categoryId: number;
  categoryName: string;
  subcategoryId: number;
  subcategoryName: string;
  grossAmount: number;
  gstAmount: number;
  netAmount: number;
  isAssetPurchase: boolean;
};

/**
 * Fields shared by every transaction shape describing where it sits in the
 * parent/child tree.
 *
 * `hasChildren` marks a container: its own amount is the whole bill and must
 * never be added to its children's. `parentTransactionId` marks a child, which
 * the UI refuses to edit directly — the API returns 409 for those.
 */
export type CorePersonalSplitFields = {
  parentTransactionId?: string | null;
  hasChildren?: boolean;
  personalPercentage?: number | null;
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
  // Migration 0037 promoted these out of metadata.asset_item_name /
  // metadata.depreciation_method. Optional for the same reason reviewedBy is:
  // sample and mock row literals predate them, and the normalizers always
  // populate them from the API.
  assetName?: string | null;
  depreciationMethod?: CoreDepreciationMethod | null;
  ruleId: number | null;
  reviewStatus: CoreReviewStatus;
  // Reviewer stamp — optional so pre-workflow object literals (mocks, sample
  // rows) stay valid; the normalizers always populate them.
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  metadata: Record<string, unknown>;
  documentId: string | null;
  documentFileName: string | null;
  // Present when the transaction has an attached document. A status other than
  // "completed" means extraction has not run yet — the client deferred it by
  // choosing "Submit to accountant", and the reviewing accountant triggers it.
  documentS3Key: string | null;
  documentProcessingStatus: string | null;
  createdBy: string;
  updatedBy: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  splits: CoreTransactionSplit[];
  children?: CoreTransactionChild[];
} & CorePersonalSplitFields;

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
  // Migration 0037 promoted these out of metadata.asset_item_name /
  // metadata.depreciation_method. Optional for the same reason reviewedBy is:
  // sample and mock row literals predate them, and the normalizers always
  // populate them from the API.
  assetName?: string | null;
  depreciationMethod?: CoreDepreciationMethod | null;
  ruleId: number | null;
  reviewStatus: CoreReviewStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
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
} & CorePersonalSplitFields;

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
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  splitId: number;
  splitPercentage: number;
  splitGrossAmount: number;
  splitGstAmount: number;
  splitNetAmount: number;
  createdAt: string;
  // Optional for the same reason the reviewer stamp is: sample rows and mock
  // fixtures predate the field, and the normalizer always populates it.
  hasChildren?: boolean;
  personalPercentage?: number | null;
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

function toOptionalDepreciationMethod(value: unknown): CoreDepreciationMethod | null {
  return value === "prime_cost" || value === "diminishing_value" ? value : null;
}

function toAssetClass(value: unknown): CoreAssetClass | null {
  const s = toNullableString(value);
  if (s === "capital_works" || s === "capital_allowance") return s;
  return null;
}

function toTxnType(value: unknown): CoreTransactionType {
  const s = toStringValue(value).toLowerCase();
  if (s === "revenue" || s === "personal" || s === "cost_base") return s;
  return "expense";
}

function toReviewStatus(value: unknown): CoreReviewStatus {
  const s = toStringValue(value).toLowerCase();
  if (
    s === "unreviewed" ||
    s === "reviewed" ||
    s === "approved" ||
    s === "rejected"
  ) {
    return s;
  }
  // Fall back to "active", not "unreviewed": an absent or unrecognised value
  // must not fabricate a review request the client never made.
  return "active";
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

/**
 * Where a row sits in the parent/child tree.
 *
 * Defaults are the "no private-use split" shape, so a response from a backend
 * that predates migration 0036 normalizes to an ordinary standalone
 * transaction rather than to undefined.
 */
function normalizePersonalSplitFields(raw: RawRecord): CorePersonalSplitFields {
  return {
    parentTransactionId: toNullableString(
      raw.parent_transaction_id ?? raw.parentTransactionId,
    ),
    hasChildren: Boolean(raw.has_children ?? raw.hasChildren),
    personalPercentage: toNullableNumber(
      raw.personal_percentage ?? raw.personalPercentage,
    ),
  };
}

export function normalizeCoreTransactionChild(
  raw: RawRecord,
): CoreTransactionChild {
  return {
    id: toStringValue(raw.id),
    type: toTxnType(raw.type),
    categoryId: toNumberValue(raw.category_id ?? raw.categoryId) ?? 0,
    categoryName: toStringValue(raw.category_name ?? raw.categoryName),
    subcategoryId: toNumberValue(raw.subcategory_id ?? raw.subcategoryId) ?? 0,
    subcategoryName: toStringValue(raw.subcategory_name ?? raw.subcategoryName),
    grossAmount: toFloatValue(raw.gross_amount ?? raw.grossAmount),
    gstAmount: toFloatValue(raw.gst_amount ?? raw.gstAmount),
    netAmount: toFloatValue(raw.net_amount ?? raw.netAmount),
    isAssetPurchase: Boolean(raw.is_asset_purchase ?? raw.isAssetPurchase),
  };
}

export function normalizeCoreTransactionDetail(
  raw: RawRecord,
): CoreTransactionDetail {
  const splitsRaw = Array.isArray(raw.splits) ? raw.splits : [];
  const childrenRaw = Array.isArray(raw.children) ? raw.children : [];
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
    assetName: toStringValue(raw.asset_name ?? raw.assetName) || null,
    depreciationMethod: toOptionalDepreciationMethod(
      raw.depreciation_method ?? raw.depreciationMethod,
    ),
    effectiveLifeYears: toNullableNumber(
      raw.effective_life_years ?? raw.effectiveLifeYears,
    ),
    ruleId: toNullableInt(raw.rule_id ?? raw.ruleId),
    reviewStatus: toReviewStatus(raw.review_status ?? raw.reviewStatus),
    reviewedBy: toNullableString(raw.reviewed_by ?? raw.reviewedBy),
    reviewedByName: toNullableString(
      raw.reviewed_by_name ?? raw.reviewedByName,
    ),
    reviewedAt: toNullableString(raw.reviewed_at ?? raw.reviewedAt),
    reviewNote: toNullableString(raw.review_note ?? raw.reviewNote),
    metadata: toRecord(raw.metadata),
    documentId: toNullableString(raw.document_id ?? raw.documentId),
    documentFileName: toNullableString(raw.document_file_name ?? raw.documentFileName),
    documentS3Key: toNullableString(raw.document_s3_key ?? raw.documentS3Key),
    documentProcessingStatus: toNullableString(
      raw.document_processing_status ?? raw.documentProcessingStatus,
    ),
    createdBy: toStringValue(raw.created_by ?? raw.createdBy),
    updatedBy: toNullableString(raw.updated_by ?? raw.updatedBy),
    isDeleted: Boolean(raw.is_deleted ?? raw.isDeleted),
    createdAt: toStringValue(raw.created_at ?? raw.createdAt),
    updatedAt: toStringValue(raw.updated_at ?? raw.updatedAt),
    splits: splitsRaw
      .filter((s): s is RawRecord => typeof s === "object" && s !== null)
      .map(normalizeCoreTransactionSplit),
    children: childrenRaw
      .filter((c): c is RawRecord => typeof c === "object" && c !== null)
      .map(normalizeCoreTransactionChild),
    ...normalizePersonalSplitFields(raw),
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
    assetName: toStringValue(raw.asset_name ?? raw.assetName) || null,
    depreciationMethod: toOptionalDepreciationMethod(
      raw.depreciation_method ?? raw.depreciationMethod,
    ),
    effectiveLifeYears: toNullableNumber(
      raw.effective_life_years ?? raw.effectiveLifeYears,
    ),
    ruleId: toNullableInt(raw.rule_id ?? raw.ruleId),
    reviewStatus: toReviewStatus(raw.review_status ?? raw.reviewStatus),
    reviewedBy: toNullableString(raw.reviewed_by ?? raw.reviewedBy),
    reviewedAt: toNullableString(raw.reviewed_at ?? raw.reviewedAt),
    reviewNote: toNullableString(raw.review_note ?? raw.reviewNote),
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
    ...normalizePersonalSplitFields(raw),
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
    reviewedBy: toNullableString(raw.reviewed_by ?? raw.reviewedBy),
    reviewedAt: toNullableString(raw.reviewed_at ?? raw.reviewedAt),
    splitId: toNumberValue(raw.split_id ?? raw.splitId) ?? 0,
    splitPercentage: toFloatValue(raw.split_percentage ?? raw.splitPercentage),
    splitGrossAmount: toFloatValue(
      raw.split_gross_amount ?? raw.splitGrossAmount,
    ),
    splitGstAmount: toFloatValue(raw.split_gst_amount ?? raw.splitGstAmount),
    splitNetAmount: toFloatValue(raw.split_net_amount ?? raw.splitNetAmount),
    createdAt: toStringValue(raw.created_at ?? raw.createdAt),
    hasChildren: Boolean(raw.has_children ?? raw.hasChildren),
    personalPercentage: toNullableNumber(
      raw.personal_percentage ?? raw.personalPercentage,
    ),
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

// =============================================================================
// Transaction rules
// =============================================================================

export type CoreTransactionRuleCondition = {
  field: string;
  operator: string;
  value: unknown;
};

export type CoreTransactionRule = {
  id: number;
  orgId: string;
  entityId: string;
  propertyId: string | null;
  name: string;
  matchMode: string;
  conditions: CoreTransactionRuleCondition[];
  assignedType: string;
  assignedCategoryId: number;
  assignedSubcategoryId: number;
  autoConfirm: boolean;
  isEnabled: boolean;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
};

function normalizeRuleCondition(raw: unknown): CoreTransactionRuleCondition {
  const r = toRecord(raw);
  return {
    field: toStringValue(r.field),
    operator: toStringValue(r.operator),
    value: r.value,
  };
}

export function normalizeCoreTransactionRule(
  raw: RawRecord,
): CoreTransactionRule {
  const conditionsRaw = Array.isArray(raw.conditions) ? raw.conditions : [];
  return {
    id: toNumberValue(raw.id) ?? 0,
    orgId: toStringValue(raw.org_id ?? raw.orgId),
    entityId: toStringValue(raw.entity_id ?? raw.entityId),
    propertyId: toNullableString(raw.property_id ?? raw.propertyId),
    name: toStringValue(raw.name),
    matchMode: toStringValue(raw.match_mode ?? raw.matchMode),
    conditions: conditionsRaw.map(normalizeRuleCondition),
    assignedType: toStringValue(raw.assigned_type ?? raw.assignedType),
    assignedCategoryId:
      toNumberValue(raw.assigned_category_id ?? raw.assignedCategoryId) ?? 0,
    assignedSubcategoryId:
      toNumberValue(raw.assigned_subcategory_id ?? raw.assignedSubcategoryId) ??
      0,
    autoConfirm: Boolean(raw.auto_confirm ?? raw.autoConfirm),
    isEnabled: Boolean(raw.is_enabled ?? raw.isEnabled),
    metadata: toRecord(raw.metadata),
    createdBy: toStringValue(raw.created_by ?? raw.createdBy),
    updatedBy: toStringValue(raw.updated_by ?? raw.updatedBy),
    isDeleted: Boolean(raw.is_deleted ?? raw.isDeleted),
    createdAt: toStringValue(raw.created_at ?? raw.createdAt),
    updatedAt: toStringValue(raw.updated_at ?? raw.updatedAt),
  };
}

// Normalizes a `{ items: [...] }` rules list payload to camelCase, preserving
// any other top-level keys. Non-list payloads pass through untouched, so this
// is safe to chain after scopeRulesForAccountant (which filters on the raw
// snake_case `created_by` and must therefore run first).
export function normalizeCoreTransactionRuleList(payload: unknown): unknown {
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray((payload as { items?: unknown }).items)
  ) {
    return payload;
  }
  const items = (payload as { items: unknown[] }).items;
  return {
    ...(payload as object),
    items: items
      .filter((i): i is RawRecord => typeof i === "object" && i !== null)
      .map(normalizeCoreTransactionRule),
  };
}

// Optional server-side review filter shared by the transaction list helpers.
// ---------------------------------------------------------------------------
// Transaction list query
//
// Search, sorting, the date range and pagination are all resolved in Postgres
// rather than in the browser. Before this, the grid downloaded every row (and
// the backend silently capped each list at 100), so anything computed on the
// client was working from a truncated set.
// ---------------------------------------------------------------------------

// Sort keys the Go API whitelists. Which ones a given scope accepts depends on
// the columns that scope renders — an out-of-scope key is a 400, not a silent
// fallback. See sortExprs in internal/handlers/transaction/query.go.
export type CoreTransactionSortKey =
  | "date"
  | "created"
  | "client"
  | "entity"
  | "property"
  | "description"
  | "gross"
  | "net"
  | "share";

export type CoreTransactionListQuery = {
  search?: string;
  /** Inclusive invoice_date bounds, YYYY-MM-DD. */
  from?: string;
  to?: string;
  reviewStatus?: CoreReviewStatus;
  /**
   * The grid's two tabs. "queue" is review_status = 'unreviewed' (what a client
   * submitted for review); "ledger" is everything else. A single-value
   * reviewStatus cannot express "not unreviewed".
   */
  reviewBucket?: "queue" | "ledger";
  clientId?: string;
  entityId?: string;
  propertyId?: string;
  type?: CoreTransactionType;
  categoryId?: number | string;
  /**
   * Which level of the parent/child tree to read.
   *
   * "top" (the default when omitted) returns one row per bill: parent
   * containers and standalone transactions. "leaf" returns the rows money is
   * summed from — the business and personal children, plus standalone
   * transactions — and is what the personal list uses, paired with
   * `type: "personal"`.
   *
   * Reading both levels at once would double-count, so the backend always
   * applies one or the other.
   */
  grain?: "top" | "leaf";
  /** Filters on the depreciation flag; drives the Asset Transactions panel. */
  assetPurchase?: boolean;
  sort?: CoreTransactionSortKey | string;
  dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

export type CorePaginated<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

// The single place the query object becomes a query string, so the BFF proxy
// and any direct caller agree on parameter names.
export function transactionListQueryString(
  q: CoreTransactionListQuery = {},
): string {
  const sp = new URLSearchParams();
  const put = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === "") return;
    sp.set(key, String(value));
  };

  put("search", q.search?.trim());
  put("from", q.from);
  put("to", q.to);
  put("review_status", q.reviewStatus);
  put("review_bucket", q.reviewBucket);
  put("client_id", q.clientId);
  put("entity_id", q.entityId);
  put("property_id", q.propertyId);
  put("type", q.type);
  put("category_id", q.categoryId);
  put("grain", q.grain);
  // Explicit undefined check: `put` skips empty-ish values, and `false` is a
  // meaningful filter here (rows that are NOT asset purchases), not an absence.
  if (q.assetPurchase !== undefined) sp.set("asset_purchase", String(q.assetPurchase));
  put("sort", q.sort);
  put("dir", q.dir);
  put("limit", q.limit);
  put("offset", q.offset);

  const s = sp.toString();
  return s ? `?${s}` : "";
}

function toPaginated<T>(
  payload: unknown,
  items: T[],
  fallbackLimit: number | undefined,
): CorePaginated<T> {
  const record =
    typeof payload === "object" && payload !== null
      ? (payload as RawRecord)
      : {};
  // total is absent on a backend that predates pagination; falling back to the
  // page length keeps "Showing X of Y" truthful rather than reporting zero.
  const total = toNumberValue(record.total);
  const limit = toNumberValue(record.limit);
  const offset = toNumberValue(record.offset);
  return {
    items,
    total: total ?? items.length,
    limit: limit ?? fallbackLimit ?? items.length,
    offset: offset ?? 0,
  };
}

// ---------------------------------------------------------------------------
// GST summary (BAS labels G1 / 1A / 1B / 9)
// ---------------------------------------------------------------------------

export type CoreGstScopeLevel = "property" | "entity" | "client";

export type CoreGstOutcome = "payment_due" | "refund_due" | "nil";

export type CoreGstPeriod = {
  label: string;
  financialYear: number;
  /** 1-4, or 0 for a whole financial year / custom range. */
  quarter: number;
  from: string;
  to: string;
  custom: boolean;
};

export type CoreGstSummary = {
  scope: { level: CoreGstScopeLevel; id: string; name: string };
  period: CoreGstPeriod;
  /**
   * Which date column the period filtered on. The backend only has
   * invoice_date, so this report is accruals basis — surfaced so the UI can
   * say so rather than let someone file it as a cash-basis BAS.
   */
  dateBasis: string;
  /** G1 — total sales, GST-inclusive. */
  g1TotalSales: number;
  /** 1A — GST collected on sales. */
  gstOnSales: number;
  /** 1B — GST paid on purchases. */
  gstOnPurchases: number;
  /** 9 — signed net position; positive means payable to the ATO. */
  netGst: number;
  outcome: CoreGstOutcome;
  /** |netGst|, so the UI never renders a minus sign. */
  amountDue: number;
  salesNet: number;
  purchasesTotal: number;
  purchasesNet: number;
  salesCount: number;
  purchasesCount: number;
};

export type CoreGstQuery = {
  /** Year the FY ends in: 2026 means 1 Jul 2025 - 30 Jun 2026. */
  financialYear?: number;
  /** BAS quarter 1-4. Omit for the whole financial year. */
  quarter?: number;
  from?: string;
  to?: string;
};

/**
 * Builds the GST query string. Deliberately does NOT emit `period=` — the core
 * API rejects it, because in the reports API `period=quarter` means "the last
 * 90 days" rather than a calendar BAS quarter.
 */
export function gstQueryString(query: CoreGstQuery = {}): string {
  const params = new URLSearchParams();
  if (query.financialYear) {
    params.set("financial_year", String(query.financialYear));
  }
  if (query.quarter) params.set("quarter", String(query.quarter));
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Narrows untrusted query params into a CoreGstQuery. Used by the BFF routes
 * to forward only recognised keys upstream.
 */
export function toCoreGstQuery(params: URLSearchParams): CoreGstQuery {
  const query: CoreGstQuery = {};
  const fy = Number.parseInt(params.get("financial_year") ?? "", 10);
  if (Number.isFinite(fy)) query.financialYear = fy;
  const quarter = Number.parseInt(params.get("quarter") ?? "", 10);
  if (Number.isFinite(quarter)) query.quarter = quarter;
  const from = params.get("from");
  if (from) query.from = from;
  const to = params.get("to");
  if (to) query.to = to;
  return query;
}

function toGstOutcome(value: unknown): CoreGstOutcome {
  const s = toStringValue(value);
  return s === "payment_due" || s === "refund_due" ? s : "nil";
}

function toGstScopeLevel(value: unknown): CoreGstScopeLevel {
  const s = toStringValue(value);
  return s === "entity" || s === "client" ? s : "property";
}

export function normalizeCoreGstSummary(raw: RawRecord): CoreGstSummary {
  const scope = (raw.scope ?? {}) as RawRecord;
  const period = (raw.period ?? {}) as RawRecord;
  return {
    scope: {
      level: toGstScopeLevel(scope.level),
      id: toStringValue(scope.id),
      name: toStringValue(scope.name),
    },
    period: {
      label: toStringValue(period.label),
      financialYear:
        toNumberValue(period.financial_year ?? period.financialYear) ?? 0,
      quarter: toNumberValue(period.quarter) ?? 0,
      from: toStringValue(period.from),
      to: toStringValue(period.to),
      custom: Boolean(period.custom),
    },
    dateBasis: toStringValue(raw.date_basis ?? raw.dateBasis),
    g1TotalSales: toFloatValue(raw.g1_total_sales ?? raw.g1TotalSales),
    gstOnSales: toFloatValue(raw.gst_on_sales ?? raw.gstOnSales),
    gstOnPurchases: toFloatValue(raw.gst_on_purchases ?? raw.gstOnPurchases),
    netGst: toFloatValue(raw.net_gst ?? raw.netGst),
    outcome: toGstOutcome(raw.outcome),
    amountDue: toFloatValue(raw.amount_due ?? raw.amountDue),
    salesNet: toFloatValue(raw.sales_net ?? raw.salesNet),
    purchasesTotal: toFloatValue(raw.purchases_total ?? raw.purchasesTotal),
    purchasesNet: toFloatValue(raw.purchases_net ?? raw.purchasesNet),
    salesCount: toNumberValue(raw.sales_count ?? raw.salesCount) ?? 0,
    purchasesCount:
      toNumberValue(raw.purchases_count ?? raw.purchasesCount) ?? 0,
  };
}

export async function getCoreGstSummaryByProperty(
  token: string,
  propertyId: string,
  query?: CoreGstQuery,
) {
  const payload = await coreApiRequest(
    `/properties/${encodeURIComponent(propertyId)}/gst-summary${gstQueryString(query)}`,
    { token },
  );
  return normalizeCoreGstSummary(getJsonObject(payload));
}

export async function getCoreGstSummaryByEntity(
  token: string,
  entityId: string,
  query?: CoreGstQuery,
) {
  const payload = await coreApiRequest(
    `/entities/${encodeURIComponent(entityId)}/gst-summary${gstQueryString(query)}`,
    { token },
  );
  return normalizeCoreGstSummary(getJsonObject(payload));
}

export async function getCoreGstSummaryForClient(
  token: string,
  clientId: string,
  query?: CoreGstQuery,
) {
  const payload = await coreApiRequest(
    `/clients/${encodeURIComponent(clientId)}/gst-summary${gstQueryString(query)}`,
    { token },
  );
  return normalizeCoreGstSummary(getJsonObject(payload));
}

// ---------------------------------------------------------------------------
// Profit & Loss statement
//
// GET /properties/{id}/pnl?financial_year=YYYY
//
// The server does the aggregation. That is not an optimisation — the statement
// this replaces was summed in the browser from one capped page of
// display-grain transaction rows, which meant it deducted the private slice of
// every part-private bill, expensed capital purchases in full, added expenses
// to income instead of subtracting them, and silently reported the first fifty
// rows as a whole year.
//
// Two conventions to hold on to when rendering:
//
//   - Every amount is a POSITIVE magnitude, including expenses. The sign is a
//     display choice. `netProfit` is the one genuinely signed figure.
//   - `totals` is authoritative. Do not re-sum the lines; the server foots the
//     statement so it cannot disagree with itself.
// ---------------------------------------------------------------------------

/** One bucket of money at the three grains the statement prints. */
export type CorePnlAmount = {
  gross: number;
  gst: number;
  net: number;
};

/** A figure paired with the same figure a financial year earlier. */
export type CorePnlComparison = {
  current: CorePnlAmount;
  previous: CorePnlAmount;
};

export type CorePnlPeriod = {
  /** Year the FY ends in: 2026 means 1 Jul 2025 - 30 Jun 2026. */
  financialYear: number;
  /** Printed label, e.g. "FY 2025-26". */
  label: string;
  from: string;
  to: string;
};

/**
 * One category/subcategory row.
 *
 * The ids are the stable key — group and diff on those, never on the display
 * name. The old client-side version matched categories by normalising strings,
 * which merged or split lines depending on punctuation.
 */
export type CorePnlLine = CorePnlComparison & {
  categoryId: number;
  categoryName: string;
  subcategoryId: number;
  subcategoryName: string;
};

/**
 * A depreciation deduction. These have no transaction rows in the reporting
 * year — they come from the schedules written when each asset was saved — so
 * they are a separate band rather than an expense category.
 */
export type CorePnlDeductionLine = CorePnlComparison & {
  kind: "capital_works" | "capital_allowance" | string;
  label: string;
};

export type CorePnlSummary = {
  scope: { level: CoreGstScopeLevel; id: string; name: string };
  period: CorePnlPeriod;
  comparison: CorePnlPeriod;
  /** Always "invoice_date": the statement is unavoidably accruals basis. */
  dateBasis: string;
  income: CorePnlLine[];
  expenses: CorePnlLine[];
  deductions: CorePnlDeductionLine[];
  totals: {
    income: CorePnlComparison;
    expenses: CorePnlComparison;
    deductions: CorePnlComparison;
    /** Income - expenses - deductions. Negative is a loss. */
    netProfit: CorePnlComparison;
  };
};

function toPnlAmount(value: unknown): CorePnlAmount {
  const raw = (value ?? {}) as RawRecord;
  return {
    gross: toFloatValue(raw.gross),
    gst: toFloatValue(raw.gst),
    net: toFloatValue(raw.net),
  };
}

function toPnlComparison(raw: RawRecord): CorePnlComparison {
  return {
    current: toPnlAmount(raw.current),
    previous: toPnlAmount(raw.previous),
  };
}

function toPnlPeriod(value: unknown): CorePnlPeriod {
  const raw = (value ?? {}) as RawRecord;
  return {
    financialYear: toNumberValue(raw.financial_year ?? raw.financialYear) ?? 0,
    label: toStringValue(raw.label),
    from: toStringValue(raw.from),
    to: toStringValue(raw.to),
  };
}

function toPnlLines(value: unknown): CorePnlLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is RawRecord => typeof item === "object" && item !== null)
    .map((raw) => ({
      categoryId: toNumberValue(raw.category_id ?? raw.categoryId) ?? 0,
      categoryName: toStringValue(raw.category_name ?? raw.categoryName),
      subcategoryId: toNumberValue(raw.subcategory_id ?? raw.subcategoryId) ?? 0,
      subcategoryName: toStringValue(raw.subcategory_name ?? raw.subcategoryName),
      ...toPnlComparison(raw),
    }));
}

function toPnlDeductions(value: unknown): CorePnlDeductionLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is RawRecord => typeof item === "object" && item !== null)
    .map((raw) => ({
      kind: toStringValue(raw.kind),
      label: toStringValue(raw.label),
      ...toPnlComparison(raw),
    }));
}

export function normalizeCorePnlSummary(raw: RawRecord): CorePnlSummary {
  const scope = (raw.scope ?? {}) as RawRecord;
  const totals = (raw.totals ?? {}) as RawRecord;
  return {
    scope: {
      level: toGstScopeLevel(scope.level),
      id: toStringValue(scope.id),
      name: toStringValue(scope.name),
    },
    period: toPnlPeriod(raw.period),
    comparison: toPnlPeriod(raw.comparison),
    dateBasis: toStringValue(raw.date_basis ?? raw.dateBasis),
    income: toPnlLines(raw.income),
    expenses: toPnlLines(raw.expenses),
    deductions: toPnlDeductions(raw.deductions),
    totals: {
      income: toPnlComparison((totals.income ?? {}) as RawRecord),
      expenses: toPnlComparison((totals.expenses ?? {}) as RawRecord),
      deductions: toPnlComparison((totals.deductions ?? {}) as RawRecord),
      netProfit: toPnlComparison(
        (totals.net_profit ?? totals.netProfit ?? {}) as RawRecord,
      ),
    },
  };
}

export async function getCorePnlSummaryByProperty(
  token: string,
  propertyId: string,
  financialYear?: number,
) {
  const qs = financialYear ? `?financial_year=${financialYear}` : "";
  const payload = await coreApiRequest(
    `/properties/${encodeURIComponent(propertyId)}/pnl${qs}`,
    { token },
  );
  return normalizeCorePnlSummary(getJsonObject(payload));
}

// -----------------------------------------------------------------------------
// Personal (private-use) spending summary
// -----------------------------------------------------------------------------

/**
 * Private, non-deductible spending totalled by category, for the Personal
 * Transactions panel on the property, entity and client pages.
 *
 * Aggregated server-side rather than by filtering a page's transactions array:
 * that array is one capped page at display grain, where the personal child of a
 * part-private bill is hidden and its container is typed 'expense'. Totalling
 * it client-side therefore both truncates and misses every partial split.
 *
 * Amounts are positive magnitudes; private spending is money out by definition,
 * so the UI applies the sign.
 */
export type CorePersonalCategoryTotal = {
  categoryId: number;
  categoryName: string;
  subcategoryName: string;
  grossAmount: number;
  gstAmount: number;
  netAmount: number;
  count: number;
};

export type CorePersonalSummary = {
  scope: { level: CoreGstScopeLevel; id: string; name: string };
  categories: CorePersonalCategoryTotal[];
  totalGross: number;
  totalGst: number;
  totalNet: number;
  count: number;
};

export function normalizeCorePersonalSummary(
  raw: RawRecord,
): CorePersonalSummary {
  const scope = toRecord(raw.scope);
  const categories = Array.isArray(raw.categories) ? raw.categories : [];
  return {
    scope: {
      level: (toStringValue(scope.level) || "entity") as CoreGstScopeLevel,
      id: toStringValue(scope.id),
      name: toStringValue(scope.name),
    },
    categories: categories
      .filter((c): c is RawRecord => typeof c === "object" && c !== null)
      .map((c) => ({
        categoryId: toNumberValue(c.category_id ?? c.categoryId) ?? 0,
        categoryName: toStringValue(c.category_name ?? c.categoryName),
        subcategoryName: toStringValue(c.subcategory_name ?? c.subcategoryName),
        grossAmount: toFloatValue(c.gross_amount ?? c.grossAmount),
        gstAmount: toFloatValue(c.gst_amount ?? c.gstAmount),
        netAmount: toFloatValue(c.net_amount ?? c.netAmount),
        count: toNumberValue(c.count) ?? 0,
      })),
    totalGross: toFloatValue(raw.total_gross ?? raw.totalGross),
    totalGst: toFloatValue(raw.total_gst ?? raw.totalGst),
    totalNet: toFloatValue(raw.total_net ?? raw.totalNet),
    count: toNumberValue(raw.count) ?? 0,
  };
}

export async function getCorePersonalSummaryForProperty(
  token: string,
  propertyId: string,
) {
  const payload = await coreApiRequest(
    `/properties/${encodeURIComponent(propertyId)}/personal-summary`,
    { token },
  );
  return normalizeCorePersonalSummary(getJsonObject(payload));
}

export async function getCorePersonalSummaryForEntity(
  token: string,
  entityId: string,
) {
  const payload = await coreApiRequest(
    `/entities/${encodeURIComponent(entityId)}/personal-summary`,
    { token },
  );
  return normalizeCorePersonalSummary(getJsonObject(payload));
}

export async function getCorePersonalSummaryForClient(
  token: string,
  clientId: string,
) {
  const payload = await coreApiRequest(
    `/clients/${encodeURIComponent(clientId)}/personal-summary`,
    { token },
  );
  return normalizeCorePersonalSummary(getJsonObject(payload));
}

// Narrows an untrusted query-param value to a CoreReviewStatus, or undefined
// when absent/invalid — used by BFF routes forwarding ?review_status=.
export function toCoreReviewStatusParam(
  value: string | null,
): CoreReviewStatus | undefined {
  const s = (value ?? "").trim().toLowerCase();
  if (
    s === "active" ||
    s === "unreviewed" ||
    s === "reviewed" ||
    s === "approved" ||
    s === "rejected"
  ) {
    return s;
  }
  return undefined;
}

// GET /transactions — the org-wide list behind the "All Transactions" page.
// This replaces a BFF fan-out that issued one upstream call per client, then
// per entity, then per property, and merged every row in Node memory.
export async function listCoreTransactionsForOrg(
  token: string,
  query: CoreTransactionListQuery = {},
) {
  const payload = await coreApiRequest(
    `/transactions${transactionListQueryString(query)}`,
    { token },
  );
  const items = getJsonArray(payload).map(normalizeCoreTransactionListItem);
  return toPaginated(payload, items, query.limit);
}

export async function listCoreTransactionsByClient(
  token: string,
  clientId: string,
  query: CoreTransactionListQuery = {},
) {
  const payload = await coreApiRequest(
    `/clients/${encodeURIComponent(clientId)}/transactions${transactionListQueryString(query)}`,
    { token },
  );
  const items = getJsonArray(payload).map(normalizeCoreTransactionListItem);
  return toPaginated(payload, items, query.limit);
}

export async function listCoreTransactionsByEntity(
  token: string,
  entityId: string,
  query: CoreTransactionListQuery = {},
) {
  const payload = await coreApiRequest(
    `/entities/${encodeURIComponent(entityId)}/transactions${transactionListQueryString(query)}`,
    { token },
  );
  const items = getJsonArray(payload).map(normalizeCoreTransactionListItem);
  return toPaginated(payload, items, query.limit);
}

export async function listCoreTransactionsByProperty(
  token: string,
  propertyId: string,
  query: CoreTransactionListQuery = {},
) {
  const payload = await coreApiRequest(
    `/properties/${encodeURIComponent(propertyId)}/transactions${transactionListQueryString(query)}`,
    { token },
  );
  const items = getJsonArray(payload).map(normalizeCorePropertyTransactionRow);
  return toPaginated(payload, items, query.limit);
}

// GET /transactions/facets — the filter dropdown options and the review-status
// tab counts for a scope. Both used to be derived in the browser from the fully
// loaded row array; under server pagination that array is one page, so they
// need their own aggregate.
export type CoreTransactionFacetOption = {
  id: string;
  name: string;
  /** Categories only — lets the grid tint each option revenue/expense. */
  type?: string;
};

export type CoreTransactionFacets = {
  reviewStatusCounts: Record<string, number>;
  clients: CoreTransactionFacetOption[];
  entities: CoreTransactionFacetOption[];
  properties: CoreTransactionFacetOption[];
  categories: CoreTransactionFacetOption[];
  types: string[];
};

function toFacetOptions(value: unknown): CoreTransactionFacetOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is RawRecord => typeof item === "object" && item !== null)
    .map((item) => {
      const type = toStringValue(item.type);
      return {
        id: toStringValue(item.id),
        name: toStringValue(item.name),
        ...(type ? { type } : {}),
      };
    })
    .filter((option) => option.id !== "");
}

export async function getCoreTransactionFacets(
  token: string,
  query: CoreTransactionListQuery = {},
): Promise<CoreTransactionFacets> {
  const payload = await coreApiRequest(
    `/transactions/facets${transactionListQueryString(query)}`,
    { token },
  );
  const record = getJsonObject(payload);

  const counts: Record<string, number> = {};
  const rawCounts = record.review_status_counts ?? record.reviewStatusCounts;
  if (typeof rawCounts === "object" && rawCounts !== null) {
    for (const [key, value] of Object.entries(rawCounts as RawRecord)) {
      counts[key] = toNumberValue(value) ?? 0;
    }
  }

  return {
    reviewStatusCounts: counts,
    clients: toFacetOptions(record.clients),
    entities: toFacetOptions(record.entities),
    properties: toFacetOptions(record.properties),
    categories: toFacetOptions(record.categories),
    types: Array.isArray(record.types)
      ? record.types.map((t) => toStringValue(t)).filter(Boolean)
      : [],
  };
}

export type CoreTransactionExportFormat = "csv" | "xlsx" | "pdf";

// Returns the upstream Response untouched so the BFF can stream the body
// through instead of buffering an export in Node memory.
export async function fetchCoreTransactionExport(
  token: string,
  format: CoreTransactionExportFormat,
  query: CoreTransactionListQuery = {},
): Promise<Response> {
  const qs = transactionListQueryString({ ...query, limit: undefined, offset: undefined });
  const separator = qs ? "&" : "?";
  return fetch(
    `${getCoreApiBaseUrl()}/transactions/export${qs}${separator}format=${encodeURIComponent(format)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
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

// Approve / reject / reset one transaction. Accountant/admin only — the
// backend 403s clients. Returns the updated transaction detail with the
// reviewer stamp (reviewedBy/reviewedAt/reviewNote) applied.
export async function reviewCoreTransaction(
  token: string,
  id: string,
  action: CoreReviewAction,
  note?: string,
) {
  const body: Record<string, unknown> = { action };
  if (note !== undefined) body.note = note;
  const payload = await coreApiRequest(
    `/transactions/${encodeURIComponent(id)}/review`,
    { method: "POST", token, body },
  );
  return normalizeCoreTransactionDetail(getJsonObject(payload));
}

export type CoreBulkReviewResult = {
  id: string;
  ok: boolean;
  error: string | null;
};

export type CoreBulkReviewResponse = {
  updated: number;
  results: CoreBulkReviewResult[];
};

// Apply one review action to up to 200 transactions. Rows fail independently;
// inspect `results` for per-id errors.
export async function bulkReviewCoreTransactions(
  token: string,
  ids: string[],
  action: CoreReviewAction,
  note?: string,
): Promise<CoreBulkReviewResponse> {
  const body: Record<string, unknown> = { ids, action };
  if (note !== undefined) body.note = note;
  const payload = await coreApiRequest("/transactions/review/bulk", {
    method: "POST",
    token,
    body,
  });
  const record = getJsonObject(payload);
  const resultsRaw = Array.isArray(record.results) ? record.results : [];
  return {
    updated: toNumberValue(record.updated) ?? 0,
    results: resultsRaw
      .filter((r): r is RawRecord => typeof r === "object" && r !== null)
      .map((r) => ({
        id: toStringValue(r.id),
        ok: Boolean(r.ok),
        error: toNullableString(r.error),
      })),
  };
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

/** One CSV data row the backend could not parse and left out of the results. */
export type ReconciliationSkippedRow = { line: number; reason: string };

export type ReconciliationSummary = {
  totalTransactions: number;
  totalDebits: number;
  totalCredits: number;
  pagesProcessed: number;
  pagesSkipped: number;
  processingTimeSeconds: number;
  /** Only populated for CSV statements. */
  skippedRows: ReconciliationSkippedRow[];
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
  const skippedRaw = raw.skipped_rows ?? raw.skippedRows;
  return {
    totalTransactions: Number(raw.total_transactions ?? raw.totalTransactions ?? 0),
    totalDebits: Number(raw.total_debits ?? raw.totalDebits ?? 0),
    totalCredits: Number(raw.total_credits ?? raw.totalCredits ?? 0),
    pagesProcessed: Number(raw.pages_processed ?? raw.pagesProcessed ?? 0),
    pagesSkipped: Number(raw.pages_skipped ?? raw.pagesSkipped ?? 0),
    processingTimeSeconds: Number(raw.processing_time_seconds ?? raw.processingTimeSeconds ?? 0),
    skippedRows: Array.isArray(skippedRaw)
      ? (skippedRaw as RawRecord[]).map((r) => ({
          line: Number(r.line ?? 0),
          reason: String(r.reason ?? ""),
        }))
      : [],
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
): Promise<{ jobId: string; reconciliationId: string }> {
  const payload = await coreApiRequest<{ job_id: string; reconciliation_id?: string }>(
    `/api/reconciliation`,
    {
      method: "POST",
      token,
      body: { s3_key: s3Key, entity_id: entityId, session_id: sessionId },
    },
  );
  const raw = payload as { job_id: string; reconciliation_id?: string };
  return { jobId: raw.job_id, reconciliationId: raw.reconciliation_id ?? "" };
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

export async function sendWelcomeEmail(
  token: string,
  body: { email: string; dashboard_link: string },
): Promise<void> {
  await coreApiRequest("/invitations/welcome", { method: "POST", token, body });
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

// =============================================================================
// Reports (accountant activity)
//
// The backend serves accountant-scoped activity reports under /reports/*,
// derived from the audit_log. Responses are already camelCase and match the
// types below; the normalizers stay defensive (null/number coercion) per the
// conventions in this file.
// =============================================================================

export type ReportAction = "Added" | "Edited" | "Deleted";

export type ReportTimelineType = "added" | "edited" | "deleted" | "reclassified";

export type ReportSummary = {
  totalActions: number;
  clientsTouched: number;
  clientsTotal: number;
  recordsAdded: number;
  recordsEdited: number;
  recordsDeleted: number;
  categories: {
    transactions: number;
    properties: number;
    entities: number;
    documents: number;
    rules: number;
  };
};

export type ReportTimelineEvent = {
  id: string;
  clientId: string;
  clientName: string;
  action: string;
  detail: string;
  time: string;
  type: ReportTimelineType;
  timestamp: string;
};

export type ReportClient = {
  id: string;
  name: string;
  initials: string;
  entityType: string;
  portfolio: string;
  propertiesCount: number;
  entitiesCount: number;
  transactionsCount: number;
  totalActions: number;
  lastActivity: string;
};

type ReportRecordBase = {
  id: string;
  clientId: string;
  clientName: string;
  clientInitials: string;
  action: ReportAction;
  date: string;
  timestamp: string;
};

export type ReportTransaction = ReportRecordBase & {
  transactionName: string;
  category: string;
  property: string;
  amount: number;
};

export type ReportProperty = ReportRecordBase & {
  property: string;
  type: string;
  change: string;
};

export type ReportEntity = ReportRecordBase & {
  entityName: string;
  type: string;
  change: string;
};

export type ReportDocument = ReportRecordBase & {
  documentName: string;
  type: string;
  size: string;
};

export type ReportRule = ReportRecordBase & {
  ruleName: string;
  change: string;
};

export type ReportQuery = {
  period?: string;
  from?: string;
  to?: string;
  clientId?: string;
};

function reportQueryString(q: ReportQuery = {}) {
  const sp = new URLSearchParams();
  if (q.period) sp.set("period", q.period);
  if (q.from) sp.set("from", q.from);
  if (q.to) sp.set("to", q.to);
  if (q.clientId) sp.set("clientId", q.clientId);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function toReportAction(value: unknown): ReportAction {
  const s = toStringValue(value);
  return s === "Deleted" ? "Deleted" : s === "Edited" ? "Edited" : "Added";
}

function reportRecordBase(raw: RawRecord): ReportRecordBase {
  return {
    id: toStringValue(raw.id),
    clientId: toStringValue(raw.clientId ?? raw.client_id),
    clientName: toStringValue(raw.clientName ?? raw.client_name),
    clientInitials: toStringValue(raw.clientInitials ?? raw.client_initials),
    action: toReportAction(raw.action),
    date: toStringValue(raw.date),
    timestamp: toStringValue(raw.timestamp),
  };
}

function normalizeReportSummary(raw: RawRecord): ReportSummary {
  const cats = toRecord(raw.categories);
  return {
    totalActions: toNumberValue(raw.totalActions ?? raw.total_actions) ?? 0,
    clientsTouched: toNumberValue(raw.clientsTouched ?? raw.clients_touched) ?? 0,
    clientsTotal: toNumberValue(raw.clientsTotal ?? raw.clients_total) ?? 0,
    recordsAdded: toNumberValue(raw.recordsAdded ?? raw.records_added) ?? 0,
    recordsEdited: toNumberValue(raw.recordsEdited ?? raw.records_edited) ?? 0,
    recordsDeleted: toNumberValue(raw.recordsDeleted ?? raw.records_deleted) ?? 0,
    categories: {
      transactions: toNumberValue(cats.transactions) ?? 0,
      properties: toNumberValue(cats.properties) ?? 0,
      entities: toNumberValue(cats.entities) ?? 0,
      documents: toNumberValue(cats.documents) ?? 0,
      rules: toNumberValue(cats.rules) ?? 0,
    },
  };
}

function normalizeReportTimelineEvent(raw: RawRecord): ReportTimelineEvent {
  const type = toStringValue(raw.type);
  return {
    id: toStringValue(raw.id),
    clientId: toStringValue(raw.clientId ?? raw.client_id),
    clientName: toStringValue(raw.clientName ?? raw.client_name),
    action: toStringValue(raw.action),
    detail: toStringValue(raw.detail),
    time: toStringValue(raw.time),
    type: (["added", "edited", "deleted", "reclassified"].includes(type)
      ? type
      : "edited") as ReportTimelineType,
    timestamp: toStringValue(raw.timestamp),
  };
}

function normalizeReportClient(raw: RawRecord): ReportClient {
  return {
    id: toStringValue(raw.id),
    name: toStringValue(raw.name),
    initials: toStringValue(raw.initials),
    entityType: toStringValue(raw.entityType ?? raw.entity_type),
    portfolio: toStringValue(raw.portfolio),
    propertiesCount: toNumberValue(raw.propertiesCount ?? raw.properties_count) ?? 0,
    entitiesCount: toNumberValue(raw.entitiesCount ?? raw.entities_count) ?? 0,
    transactionsCount:
      toNumberValue(raw.transactionsCount ?? raw.transactions_count) ?? 0,
    totalActions: toNumberValue(raw.totalActions ?? raw.total_actions) ?? 0,
    lastActivity: toStringValue(raw.lastActivity ?? raw.last_activity),
  };
}

function normalizeReportTransaction(raw: RawRecord): ReportTransaction {
  return {
    ...reportRecordBase(raw),
    transactionName: toStringValue(raw.transactionName ?? raw.transaction_name),
    category: toStringValue(raw.category),
    property: toStringValue(raw.property),
    amount: toFloatValue(raw.amount),
  };
}

function normalizeReportProperty(raw: RawRecord): ReportProperty {
  return {
    ...reportRecordBase(raw),
    property: toStringValue(raw.property),
    type: toStringValue(raw.type),
    change: toStringValue(raw.change),
  };
}

function normalizeReportEntity(raw: RawRecord): ReportEntity {
  return {
    ...reportRecordBase(raw),
    entityName: toStringValue(raw.entityName ?? raw.entity_name),
    type: toStringValue(raw.type),
    change: toStringValue(raw.change),
  };
}

function normalizeReportDocument(raw: RawRecord): ReportDocument {
  return {
    ...reportRecordBase(raw),
    documentName: toStringValue(raw.documentName ?? raw.document_name),
    type: toStringValue(raw.type),
    size: toStringValue(raw.size),
  };
}

function normalizeReportRule(raw: RawRecord): ReportRule {
  return {
    ...reportRecordBase(raw),
    ruleName: toStringValue(raw.ruleName ?? raw.rule_name),
    change: toStringValue(raw.change),
  };
}

export async function getReportSummary(token: string, q: ReportQuery = {}) {
  const payload = await coreApiRequest(`/reports/summary${reportQueryString(q)}`, {
    token,
  });
  return normalizeReportSummary(getJsonObject(payload));
}

export async function listReportTimeline(token: string, q: ReportQuery = {}) {
  const payload = await coreApiRequest(`/reports/timeline${reportQueryString(q)}`, {
    token,
  });
  return getJsonArray(payload).map(normalizeReportTimelineEvent);
}

export async function listReportClients(token: string, q: ReportQuery = {}) {
  const payload = await coreApiRequest(`/reports/clients${reportQueryString(q)}`, {
    token,
  });
  return getJsonArray(payload).map(normalizeReportClient);
}

export async function getReportClient(
  token: string,
  id: string,
  q: ReportQuery = {},
) {
  const payload = await coreApiRequest(
    `/reports/clients/${encodeURIComponent(id)}${reportQueryString(q)}`,
    { token },
  );
  return normalizeReportClient(getJsonObject(payload));
}

export async function listReportTransactions(token: string, q: ReportQuery = {}) {
  const payload = await coreApiRequest(
    `/reports/transactions${reportQueryString(q)}`,
    { token },
  );
  return getJsonArray(payload).map(normalizeReportTransaction);
}

export async function listReportProperties(token: string, q: ReportQuery = {}) {
  const payload = await coreApiRequest(
    `/reports/properties${reportQueryString(q)}`,
    { token },
  );
  return getJsonArray(payload).map(normalizeReportProperty);
}

export async function listReportEntities(token: string, q: ReportQuery = {}) {
  const payload = await coreApiRequest(`/reports/entities${reportQueryString(q)}`, {
    token,
  });
  return getJsonArray(payload).map(normalizeReportEntity);
}

export async function listReportDocuments(token: string, q: ReportQuery = {}) {
  const payload = await coreApiRequest(
    `/reports/documents${reportQueryString(q)}`,
    { token },
  );
  return getJsonArray(payload).map(normalizeReportDocument);
}

export async function listReportRules(token: string, q: ReportQuery = {}) {
  const payload = await coreApiRequest(`/reports/rules${reportQueryString(q)}`, {
    token,
  });
  return getJsonArray(payload).map(normalizeReportRule);
}

// =============================================================================
// Depreciation (migration 0037)
//
// Schedules are computed and stored by the backend when an asset is saved. The
// frontend never recalculates them: there used to be a second engine in
// AssetDepreciationDetailPage.tsx and it disagreed with the backend about leap
// years and about where a schedule ends. One engine, in Go.
// =============================================================================

export type CoreDepreciationMethod = "prime_cost" | "diminishing_value";

export type CoreDepreciationYear = {
  fyStartYear: number;
  fyLabel: string;
  periodStart: string;
  periodEnd: string;
  daysHeld: number;
  openingAdjustableValue: number;
  /** Annual percentage, e.g. 2.5 for capital works or 40 for a 5-year DV asset. */
  rate: number;
  depreciation: number;
  closingAdjustableValue: number;
  /** The year of purchase and the stub at the end of the effective life. */
  isPartial: boolean;
};

export type CoreDepreciationSchedule = {
  id: string;
  transactionId: string;
  propertyId: string;
  propertyName: string;
  entityId: string;
  entityName: string;
  clientId: string;

  assetName: string;
  assetClass: CoreAssetClass;
  depreciationMethod: CoreDepreciationMethod;
  effectiveLifeYears: number;
  startDate: string;

  costBase: number;
  personalPercentage: number;
  businessPercentage: number;
  /** Cost base after the private-use portion is removed — what the engine ran on. */
  depreciableAmount: number;
  annualRate: number;

  /** Whole-of-life figures; unaffected by any financial-year filter. */
  totalDepreciation: number;
  residualValue: number;
  /** The selected year's claim, or null when no `fy` was requested. */
  fyDepreciation: number | null;

  documentId: string | null;
  documentName: string;
  generatedAt: string;

  /** Populated by the per-transaction and single-schedule endpoints only. */
  years: CoreDepreciationYear[];
};

export type CoreDepreciationTotals = {
  assetCount: number;
  capitalWorks: number;
  capitalAllowances: number;
  depreciation: number;
  depreciableAmount: number;
  closingValue: number;
};

export type CoreDepreciationList = {
  scope: { level: string; id: string; name: string };
  fyStartYear: number | null;
  fyLabel: string;
  totals: CoreDepreciationTotals;
  items: CoreDepreciationSchedule[];
};

function toDepreciationMethod(value: unknown): CoreDepreciationMethod {
  return value === "prime_cost" ? "prime_cost" : "diminishing_value";
}

function normalizeDepreciationYear(raw: RawRecord): CoreDepreciationYear {
  return {
    fyStartYear: toNumberValue(raw.fy_start_year ?? raw.fyStartYear) ?? 0,
    fyLabel: toStringValue(raw.fy_label ?? raw.fyLabel),
    periodStart: toStringValue(raw.period_start ?? raw.periodStart),
    periodEnd: toStringValue(raw.period_end ?? raw.periodEnd),
    daysHeld: toNumberValue(raw.days_held ?? raw.daysHeld) ?? 0,
    openingAdjustableValue:
      toFloatValue(raw.opening_adjustable_value ?? raw.openingAdjustableValue) ?? 0,
    rate: toFloatValue(raw.rate) ?? 0,
    depreciation: toFloatValue(raw.depreciation) ?? 0,
    closingAdjustableValue:
      toFloatValue(raw.closing_adjustable_value ?? raw.closingAdjustableValue) ?? 0,
    isPartial: Boolean(raw.is_partial ?? raw.isPartial),
  };
}

function normalizeDepreciationSchedule(raw: RawRecord): CoreDepreciationSchedule {
  const fyDep = toFloatValue(raw.fy_depreciation ?? raw.fyDepreciation);
  return {
    id: toStringValue(raw.id),
    transactionId: toStringValue(raw.transaction_id ?? raw.transactionId),
    propertyId: toStringValue(raw.property_id ?? raw.propertyId),
    propertyName: toStringValue(raw.property_name ?? raw.propertyName),
    entityId: toStringValue(raw.entity_id ?? raw.entityId),
    entityName: toStringValue(raw.entity_name ?? raw.entityName),
    clientId: toStringValue(raw.client_id ?? raw.clientId),

    assetName: toStringValue(raw.asset_name ?? raw.assetName),
    assetClass: toAssetClass(raw.asset_class ?? raw.assetClass) ?? "capital_allowance",
    depreciationMethod: toDepreciationMethod(
      raw.depreciation_method ?? raw.depreciationMethod,
    ),
    effectiveLifeYears:
      toFloatValue(raw.effective_life_years ?? raw.effectiveLifeYears) ?? 0,
    startDate: toStringValue(raw.start_date ?? raw.startDate),

    costBase: toFloatValue(raw.cost_base ?? raw.costBase) ?? 0,
    personalPercentage:
      toFloatValue(raw.personal_percentage ?? raw.personalPercentage) ?? 0,
    businessPercentage:
      toFloatValue(raw.business_percentage ?? raw.businessPercentage) ?? 100,
    depreciableAmount:
      toFloatValue(raw.depreciable_amount ?? raw.depreciableAmount) ?? 0,
    annualRate: toFloatValue(raw.annual_rate ?? raw.annualRate) ?? 0,

    totalDepreciation:
      toFloatValue(raw.total_depreciation ?? raw.totalDepreciation) ?? 0,
    residualValue: toFloatValue(raw.residual_value ?? raw.residualValue) ?? 0,
    fyDepreciation: fyDep,

    documentId: toStringValue(raw.document_id ?? raw.documentId) || null,
    documentName: toStringValue(raw.document_name ?? raw.documentName),
    generatedAt: toStringValue(raw.generated_at ?? raw.generatedAt),

    years: Array.isArray(raw.years)
      ? raw.years.map((y) => normalizeDepreciationYear(getJsonObject(y)))
      : [],
  };
}

function normalizeDepreciationList(payload: unknown): CoreDepreciationList {
  const record = getJsonObject(payload);
  const scope = getJsonObject(record.scope);
  const totals = getJsonObject(record.totals);
  return {
    scope: {
      level: toStringValue(scope.level),
      id: toStringValue(scope.id),
      name: toStringValue(scope.name),
    },
    fyStartYear: toNumberValue(record.fy_start_year ?? record.fyStartYear),
    fyLabel: toStringValue(record.fy_label ?? record.fyLabel),
    totals: {
      assetCount: toNumberValue(totals.asset_count ?? totals.assetCount) ?? 0,
      capitalWorks: toFloatValue(totals.capital_works ?? totals.capitalWorks) ?? 0,
      capitalAllowances:
        toFloatValue(totals.capital_allowances ?? totals.capitalAllowances) ?? 0,
      depreciation: toFloatValue(totals.depreciation) ?? 0,
      depreciableAmount:
        toFloatValue(totals.depreciable_amount ?? totals.depreciableAmount) ?? 0,
      closingValue: toFloatValue(totals.closing_value ?? totals.closingValue) ?? 0,
    },
    items: Array.isArray(record.items)
      ? record.items.map((i) => normalizeDepreciationSchedule(getJsonObject(i)))
      : [],
  };
}

/** `fy` is the July side of the financial year: 2025 means FY 2025-26. */
function fyQuery(fy?: number | null) {
  return fy == null ? "" : `?fy=${encodeURIComponent(String(fy))}`;
}

export type CoreDepreciationScopeLevel =
  | "transaction"
  | "property"
  | "entity"
  | "client";

function depreciationScopePath(level: CoreDepreciationScopeLevel, id: string) {
  const encoded = encodeURIComponent(id);
  switch (level) {
    case "transaction":
      return `/transactions/${encoded}/depreciation`;
    case "property":
      return `/properties/${encoded}/depreciation`;
    case "entity":
      return `/entities/${encoded}/depreciation`;
    default:
      return `/clients/${encoded}/depreciation`;
  }
}

export async function listCoreDepreciation(
  token: string,
  level: CoreDepreciationScopeLevel,
  id: string,
  fy?: number | null,
): Promise<CoreDepreciationList> {
  const payload = await coreApiRequest(
    `${depreciationScopePath(level, id)}${fyQuery(fy)}`,
    { token },
  );
  return normalizeDepreciationList(payload);
}

export async function getCoreDepreciationSchedule(
  token: string,
  scheduleId: string,
  fy?: number | null,
): Promise<CoreDepreciationSchedule> {
  const payload = await coreApiRequest(
    `/depreciation/${encodeURIComponent(scheduleId)}${fyQuery(fy)}`,
    { token },
  );
  return normalizeDepreciationSchedule(getJsonObject(payload));
}

export async function rebuildCoreDepreciation(token: string, transactionId: string) {
  await coreApiRequest(
    `/transactions/${encodeURIComponent(transactionId)}/depreciation/rebuild`,
    { method: "POST", token },
  );
}

/**
 * The generated schedule PDF, as a raw Response so the route handler can pipe
 * the body straight through rather than buffering it — the same shape as
 * fetchCoreTransactionExport.
 */
export async function fetchCoreDepreciationDocument(
  token: string,
  scheduleId: string,
): Promise<Response> {
  return fetch(
    `${getCoreApiBaseUrl()}/depreciation/${encodeURIComponent(scheduleId)}/document`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
}
