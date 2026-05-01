import { pool } from "./db";
import { getRoleIdByName, getRoleNameById } from "./roles";
import { normalizeRoleName } from "./roleNames";

export type VerifiedTokenLike = {
  sub?: string;
  email?: string;
  name?: string;
};

export type DirectoryUser = {
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

type RawDirectoryRow = {
  id: string;
  email: string;
  full_name: string | null;
  role_id: number | string | null;
  org_id: string | null;
  org_name: string | null;
  invitation_status: string | null;
  invitation_accepted_at: Date | string | null;
  mapping_status: string | null;
  invited_by: string | null;
  invited_by_email: string | null;
  created_at: Date | string | null;
  assigned_accountant_id: string | null;
  assigned_accountant_name: string | null;
};

function toRoleIdNumber(roleId: number | string | null) {
  if (typeof roleId === "number") {
    return roleId;
  }

  if (typeof roleId === "string" && roleId.trim()) {
    const parsed = Number.parseInt(roleId, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

export function formatDisplayName(email: string) {
  const localPart = (email.split("@")[0] || "user").replace(/[._-]/g, " ");
  return localPart.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getPlatformRoleByEmail(email: string) {
  const configuredEmails =
    process.env.SUPER_ADMIN_EMAILS ||
    process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS ||
    "super_admin@company.com";
  const superAdminEmails = configuredEmails
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return superAdminEmails.includes(email.trim().toLowerCase())
    ? "super_admin"
    : "";
}

async function normalizeDirectoryUser(
  row: RawDirectoryRow,
): Promise<DirectoryUser> {
  const platformRole = getPlatformRoleByEmail(row.email || "");
  const role = normalizeRoleName(
    row.role_id === null || row.role_id === undefined
      ? platformRole
      : await getRoleNameById(row.role_id),
  );
  const roleId =
    toRoleIdNumber(row.role_id) ??
    (platformRole ? await getRoleIdByName(platformRole) : null);

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name || formatDisplayName(row.email || ""),
    role,
    roleId,
    orgId: row.org_id || "",
    orgName: row.org_name || "",
    status: String(
      row.invitation_accepted_at
        ? "ACCEPTED"
        : row.invitation_status || row.mapping_status || "active",
    ).toUpperCase(),
    invitedBy: row.invited_by || "",
    invitedByEmail: row.invited_by_email || "",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    phoneNumber: "",
    assignedAccountantId: row.assigned_accountant_id || "",
    assignedAccountantName: row.assigned_accountant_name || "",
  };
}

export async function findDirectoryUserByIdentity(identity: {
  id?: string;
  email?: string;
}): Promise<DirectoryUser | null> {
  const email = String(identity.email || "")
    .trim()
    .toLowerCase();
  const id = String(identity.id || "").trim();

  if (!email && !id) {
    return null;
  }

  const result = await pool.query<RawDirectoryRow>(
    `SELECT
       u.id,
       u.email,
       u.full_name,
       m.role_id,
       m.org_id,
       o.org_name,
       inv.status AS invitation_status,
       inv.accepted_at AS invitation_accepted_at,
       m.status AS mapping_status,
       inv.invited_by,
       inviter.email AS invited_by_email,
       COALESCE(inv.created_at, u.created_at) AS created_at,
       u.assigned_accountant_id,
       assigned_accountant.full_name AS assigned_accountant_name
     FROM users u
     LEFT JOIN LATERAL (
       SELECT org_id, role_id, status, created_at
       FROM org_user_mapping
       WHERE user_id = u.id
       ORDER BY created_at DESC NULLS LAST, id DESC
       LIMIT 1
     ) m ON true
     LEFT JOIN organisation o ON o.id = m.org_id
     LEFT JOIN LATERAL (
       SELECT status, invited_by, created_at, accepted_at
       FROM user_invitation
       WHERE lower(email) = lower(u.email)
         AND (m.org_id IS NULL OR org_id = m.org_id)
       ORDER BY created_at DESC NULLS LAST
       LIMIT 1
     ) inv ON true
     LEFT JOIN users inviter ON inviter.id = inv.invited_by
     LEFT JOIN users assigned_accountant ON assigned_accountant.id = u.assigned_accountant_id
     WHERE ($1 <> '' AND u.id = $1)
        OR ($2 <> '' AND lower(u.email) = $2)
     ORDER BY CASE WHEN u.id = $1 THEN 0 ELSE 1 END
     LIMIT 1`,
    [id, email],
  );

  const row = result.rows[0];
  return row ? await normalizeDirectoryUser(row) : null;
}

export async function listDirectoryUsers(filter?: {
  orgId?: string;
  roleIds?: number[];
}): Promise<DirectoryUser[]> {
  const orgId = String(filter?.orgId || "").trim();
  const roleIds = (filter?.roleIds || []).filter((value): value is number =>
    Number.isFinite(value),
  );

  const result = await pool.query<RawDirectoryRow>(
    `SELECT
       u.id,
       u.email,
       u.full_name,
       m.role_id,
       m.org_id,
       o.org_name,
       inv.status AS invitation_status,
       inv.accepted_at AS invitation_accepted_at,
       m.status AS mapping_status,
       inv.invited_by,
       inviter.email AS invited_by_email,
       COALESCE(inv.created_at, u.created_at) AS created_at,
       u.assigned_accountant_id,
       assigned_accountant.full_name AS assigned_accountant_name
     FROM users u
     JOIN org_user_mapping m ON m.user_id = u.id
     LEFT JOIN organisation o ON o.id = m.org_id
     LEFT JOIN LATERAL (
       SELECT status, invited_by, created_at, accepted_at
       FROM user_invitation
       WHERE lower(email) = lower(u.email)
         AND org_id = m.org_id
       ORDER BY created_at DESC NULLS LAST
       LIMIT 1
     ) inv ON true
     LEFT JOIN users inviter ON inviter.id = inv.invited_by
     LEFT JOIN users assigned_accountant ON assigned_accountant.id = u.assigned_accountant_id
     WHERE ($1 = '' OR m.org_id = $1::uuid)
       AND (cardinality($2::bigint[]) = 0 OR m.role_id = ANY($2::bigint[]))
     ORDER BY COALESCE(inv.created_at, u.created_at) DESC NULLS LAST, u.email ASC`,
    [orgId, roleIds],
  );

  return Promise.all(result.rows.map(normalizeDirectoryUser));
}

export async function assignClientsToAccountant({
  clientIds,
  accountantId,
  orgId,
  clientRoleId,
}: {
  clientIds: string[];
  accountantId: string;
  orgId: string;
  clientRoleId: number;
}) {
  const uniqueClientIds = Array.from(
    new Set(clientIds.map((id) => id.trim()).filter(Boolean)),
  );

  if (uniqueClientIds.length === 0) {
    return [];
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const candidates = await client.query<{
      id: string;
      assigned_accountant_id: string | null;
    }>(
      `SELECT u.id, u.assigned_accountant_id
       FROM users u
       JOIN org_user_mapping m ON m.user_id = u.id
       WHERE u.id = ANY($1::varchar[])
         AND m.org_id = $2::uuid
         AND m.role_id = $3::bigint
       FOR UPDATE OF u`,
      [uniqueClientIds, orgId, clientRoleId],
    );

    const foundIds = new Set(candidates.rows.map((row) => row.id));
    const blockedIds = candidates.rows
      .filter((row) => row.assigned_accountant_id)
      .map((row) => row.id);

    if (foundIds.size !== uniqueClientIds.length || blockedIds.length > 0) {
      await client.query("ROLLBACK");
      return [];
    }

    const result = await client.query<{ id: string }>(
      `UPDATE users
       SET assigned_accountant_id = $1
       WHERE id = ANY($2::varchar[])
       RETURNING id`,
      [accountantId, uniqueClientIds],
    );

    await client.query("COMMIT");
    return result.rows.map((row) => row.id);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getOrganizationById(orgId: string) {
  const result = await pool.query(
    `SELECT id, org_name
     FROM organisation
     WHERE id = $1
     LIMIT 1`,
    [orgId],
  );

  const row = result.rows[0];
  return row ? { id: row.id as string, name: row.org_name as string } : null;
}
