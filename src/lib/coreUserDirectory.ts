import {
  getCoreOrganizationById,
  getCoreRoleId,
  listCoreUsers,
  updateCoreUser,
  type CoreUser,
} from "./coreApi";

export type ApiDirectoryUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  roleId: number | null;
  orgId: string;
  orgName: string;
  status: string;
  invitedBy: string;
  invitedByEmail: string;
  createdAt: string | null;
  phoneNumber: string;
  assignedAccountantId: string;
  assignedAccountantName: string;
};

function normalizeStatus(status: string) {
  const normalized = String(status || "").trim().toUpperCase();

  if (!normalized || normalized === "ACTIVE") {
    return "ACTIVE";
  }

  return normalized;
}

export function formatDisplayName(email: string) {
  const localPart = (email.split("@")[0] || "user").replace(/[._-]/g, " ");
  return localPart.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toDirectoryUser(user: CoreUser): ApiDirectoryUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName || formatDisplayName(user.email || ""),
    role: user.role,
    roleId: user.roleId,
    orgId: user.orgId,
    orgName: user.orgName,
    status: normalizeStatus(user.status),
    invitedBy: user.invitedBy,
    invitedByEmail: user.invitedByEmail,
    createdAt: user.createdAt,
    phoneNumber: user.phoneNumber,
    assignedAccountantId: user.assignedAccountantId,
    assignedAccountantName: user.assignedAccountantName,
  };
}

export async function findApiDirectoryUserByIdentity(
  token: string,
  identity: {
    id?: string;
    email?: string;
  },
) {
  const id = String(identity.id || "").trim();
  const email = String(identity.email || "").trim().toLowerCase();

  if (!id && !email) {
    return null;
  }

  const users = await listCoreUsers(token);
  const match = users.find(
    (user) =>
      (id && user.id === id) ||
      (email && user.email.toLowerCase() === email),
  );

  return match ? toDirectoryUser(match) : null;
}

export async function listApiDirectoryUsers(
  token: string,
  filter?: {
    orgId?: string;
    roleIds?: number[];
  },
) {
  const orgId = String(filter?.orgId || "").trim();
  const roleIds = (filter?.roleIds || []).filter(
    (value): value is number => Number.isFinite(value),
  );

  const users = (await listCoreUsers(token)).map(toDirectoryUser);

  return users.filter(
    (user) =>
      (!orgId || user.orgId === orgId) &&
      (roleIds.length === 0 ||
        (user.roleId !== null && roleIds.includes(user.roleId))),
  );
}

export async function getApiOrganizationById(token: string, orgId: string) {
  if (!orgId) {
    return null;
  }

  const organization = await getCoreOrganizationById(token, orgId).catch(() => null);

  return organization?.id
    ? {
        id: organization.id,
        name: organization.name,
      }
    : null;
}

export async function assignApiClientsToAccountant(params: {
  token: string;
  clientIds: string[];
  accountantId: string;
  accountantName: string;
}) {
  const updated = await Promise.all(
    params.clientIds.map((clientId) =>
      updateCoreUser(params.token, clientId, {
        assigned_accountant_id: params.accountantId,
        assigned_accountant_name: params.accountantName,
      }),
    ),
  );

  return updated.map((user) => ({
    id: user.id,
    assigned_accountant_id: user.assignedAccountantId || params.accountantId,
  }));
}

export function getRoleIdsFor(...roles: string[]) {
  return roles
    .map((role) => getCoreRoleId(role))
    .filter((value): value is number => value !== null);
}
