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
      (item): item is RawRecord =>
        typeof item === "object" && item !== null,
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
        (item): item is RawRecord =>
          typeof item === "object" && item !== null,
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
  const candidates = [record.data, record.item, record.user, record.organization];

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
    typeof value === "number" ? value : Number.parseInt(toStringValue(value), 10);
  return Number.isNaN(asNumber) ? null : asNumber;
}

function getConfiguredRoleMap() {
  return {
    super_admin: Number(process.env.CORE_API_ROLE_ID_SUPER_ADMIN || 1),
    admin: Number(process.env.CORE_API_ROLE_ID_ADMIN || 2),
    accountant: Number(process.env.CORE_API_ROLE_ID_ACCOUNTANT || 3),
    client: Number(process.env.CORE_API_ROLE_ID_CLIENT || 4),
  };
}

export function getCoreRoleId(role: string) {
  const roleMap = getConfiguredRoleMap();
  return roleMap[role as keyof typeof roleMap] ?? null;
}

function getRoleName(raw: RawRecord) {
  const directRole = toStringValue(raw.role || raw.role_name || raw.roleName)
    .trim()
    .toLowerCase();

  if (directRole) {
    return directRole;
  }

  const roleId = toNumberValue(raw.role_id || raw.roleId);
  const roleMap = getConfiguredRoleMap();
  const match = Object.entries(roleMap).find(([, value]) => value === roleId);
  return match?.[0] || "unknown";
}

export function normalizeCoreUser(raw: RawRecord): CoreUser {
  return {
    id: toStringValue(raw.id || raw.user_id || raw.userId),
    email: toStringValue(raw.email),
    fullName: toStringValue(raw.full_name || raw.fullName),
    role: getRoleName(raw),
    roleId: toNumberValue(raw.role_id || raw.roleId),
    orgId: toStringValue(raw.org_id || raw.organization_id || raw.orgId),
    status: toStringValue(raw.status || (raw.is_active === false ? "INACTIVE" : "ACTIVE")),
    phoneNumber: toStringValue(raw.phone || raw.phone_number || raw.phoneNumber),
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
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      `Core API ${method} ${path} failed: ${
        (payload as RawRecord | null)?.message ||
        (payload as RawRecord | null)?.error ||
        response.statusText
      }`,
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

export async function createCoreUser(token: string, body: Record<string, unknown>) {
  const payload = await coreApiRequest("/users", {
    method: "POST",
    token,
    body,
  });
  return normalizeCoreUser(getJsonObject(payload));
}
