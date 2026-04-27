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

function parseCookieHeader(cookieHeader: string | null) {
  const cookies = new Map<string, string>();

  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) continue;
    cookies.set(rawName, decodeURIComponent(rawValue.join("=")));
  }

  return cookies;
}

export function getCoreApiBearerFromRequest(req: Request, fallbackToken = "") {
  const cookies = parseCookieHeader(req.headers.get("cookie"));
  const accessToken = (cookies.get("accessToken") || "").trim();
  return accessToken || fallbackToken;
}

function getCoreApiBaseUrl() {
  const baseUrl =
    process.env.CORE_API_BASE_URL || process.env.NEXT_PUBLIC_CORE_API_BASE_URL;

  if (!baseUrl) {
    throw new Error("CORE_API_BASE_URL is not configured");
  }

  return baseUrl.replace(/\/+$/, "");
}

function getCoreApiKey() {
  return (
    process.env.CORE_API_KEY ||
    process.env.NEXT_PUBLIC_CORE_API_KEY ||
    process.env.CORE_API_X_API_KEY ||
    ""
  ).trim();
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

function toBooleanValue(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = toStringValue(value).trim().toLowerCase();

  if (["true", "1", "yes"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no"].includes(normalized)) {
    return false;
  }

  return null;
}

function getNestedString(raw: RawRecord, key: string) {
  const value = raw[key];
  return typeof value === "object" && value !== null
    ? toStringValue((value as RawRecord).name || (value as RawRecord).email)
    : "";
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
  const organization = raw.organization || raw.organisation;
  const inviter = raw.inviter || raw.invitedByUser || raw.createdByUser;
  const assignedAccountant =
    raw.assigned_accountant || raw.assignedAccountant || raw.accountant;
  const isActive = toBooleanValue(
    raw.is_active ?? raw.isActive ?? raw.active,
  );
  const status = toStringValue(raw.status || raw.user_status || raw.userStatus);

  return {
    id: toStringValue(raw.id || raw.user_id || raw.userId),
    email: toStringValue(raw.email),
    fullName: toStringValue(raw.full_name || raw.fullName),
    role: getRoleName(raw),
    roleId: toNumberValue(raw.role_id || raw.roleId),
    orgId:
      toStringValue(
        raw.org_id ||
          raw.organization_id ||
          raw.organisation_id ||
          raw.orgId ||
          raw.organizationId ||
          raw.organisationId,
      ) ||
      (typeof organization === "object" && organization !== null
        ? toStringValue(
            (organization as RawRecord).id ||
              (organization as RawRecord).org_id ||
              (organization as RawRecord).orgId,
          )
        : ""),
    orgName:
      toStringValue(
        raw.org_name ||
          raw.orgName ||
          raw.organization_name ||
          raw.organisation_name,
      ) ||
      (typeof organization === "object" && organization !== null
        ? toStringValue(
            (organization as RawRecord).name ||
              (organization as RawRecord).org_name ||
              (organization as RawRecord).orgName,
          )
        : ""),
    status: status || (isActive === false ? "INACTIVE" : "ACTIVE"),
    phoneNumber: toStringValue(
      raw.phone || raw.phone_number || raw.phoneNumber,
    ),
    invitedBy: toStringValue(raw.invited_by || raw.invitedBy || raw.created_by),
    invitedByEmail:
      toStringValue(
        raw.invited_by_email || raw.invitedByEmail || raw.created_by_email,
      ) ||
      (typeof inviter === "object" && inviter !== null
        ? toStringValue((inviter as RawRecord).email)
        : getNestedString(raw, "inviter")),
    createdAt: toStringValue(raw.created_at || raw.createdAt) || null,
    assignedAccountantId: toStringValue(
      raw.assigned_accountant_id ||
        raw.assignedAccountantId ||
        raw.accountant_id ||
        raw.accountantId,
    ),
    assignedAccountantName:
      toStringValue(
        raw.assigned_accountant_name ||
          raw.assignedAccountantName ||
          raw.accountant_name ||
          raw.accountantName,
      ) ||
      (typeof assignedAccountant === "object" && assignedAccountant !== null
        ? toStringValue(
            (assignedAccountant as RawRecord).full_name ||
              (assignedAccountant as RawRecord).fullName ||
              (assignedAccountant as RawRecord).name,
          )
        : ""),
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

  const apiKey = getCoreApiKey();

  if (apiKey) {
    headers["x-api-key"] = apiKey;
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
    const error = new Error(
      `Core API ${method} ${path} failed: ${
        (payload as RawRecord | null)?.message ||
        (payload as RawRecord | null)?.error ||
        response.statusText
      }`,
    ) as Error & { status?: number };
    error.status = response.status;
    throw error;
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

export async function getCoreUserById(token: string, userId: string) {
  const payload = await coreApiRequest(`/users/${userId}`, { token });
  return normalizeCoreUser(getJsonObject(payload));
}

export async function updateCoreUser(
  token: string,
  userId: string,
  body: Record<string, unknown>,
) {
  const payload = await coreApiRequest(`/users/${userId}`, {
    method: "PATCH",
    token,
    body,
  });
  return normalizeCoreUser(getJsonObject(payload));
}
